import Viaje from '../models/Viaje.model.js';
import Transportista from '../models/Transportista.model.js';
import Chofer from '../models/Chofer.model.js';
import WhatsAppSession from '../models/WhatsAppSession.model.js';
import WhatsAppMessage from '../models/WhatsAppMessage.model.js';
import whatsappService from '../services/whatsapp.service.js';
import { sanitizeError } from '../utils/sanitizeError.js';

// Normaliza cualquier número argentino a "549XXXXXXXXXX" (solo dígitos)
function normalizePhone(phone) {
  if (!phone) return '';
  let n = String(phone).replace(/[\s\-\+\(\)]/g, '').replace(/\D/g, '');
  if (n.startsWith('549')) return n;
  if (n.startsWith('54')) return '549' + n.slice(2);
  if (n.length === 10) return '549' + n;
  return n;
}


export const getTripOffers = async (req, res) => {
  try {
    const { tripId } = req.params;
    const sessions = await WhatsAppSession.find({
      viajeId: tripId,
      context: { $in: ['trip_offer', 'waiting_truck_count'] },
      'metadata.camionesCometidos': { $exists: true }
    }).lean();

    const offers = await Promise.all(sessions.map(async (s) => {
      let nombre = null;
      let telefono = null;
      let email = null;
      let tipo = null;

      if (s.transportistaId) {
        const t = await Transportista.findById(s.transportistaId, 'razonSocial nombreConductor numeroWhatsapp emailContacto').lean();
        if (t) {
          nombre = t.razonSocial;
          telefono = t.numeroWhatsapp;
          email = t.emailContacto;
          tipo = 'transportista';
        }
      } else if (s.choferId) {
        const c = await Chofer.findById(s.choferId, 'nombre telefono email transportistas').lean();
        if (c) {
          telefono = c.telefono;
          email = c.email;
          if (c.transportistas && c.transportistas.length > 0) {
            const t = await Transportista.findById(c.transportistas[0], 'razonSocial').lean();
            nombre = t ? t.razonSocial : c.nombre;
            tipo = 'transportista';
          } else {
            nombre = c.nombre;
            tipo = 'chofer';
          }
        }
      }

      return {
        _id: s._id,
        nombre,
        telefono,
        email,
        tipo,
        camionesCometidos: s.metadata?.camionesCometidos,
        respondidoEn: s.updatedAt,
      };
    }));

    res.json(offers.filter(o => o.nombre));
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const sendOfferToCarriers = async (req, res) => {
  try {
    const { tripId, transportistaIds } = req.body;
    
    const viaje = await Viaje.findById(tripId).populate('productor');
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    let destinatarios = [];

    if (transportistaIds && transportistaIds.length > 0) {
      const transEncontrados = await Transportista.find({ _id: { $in: transportistaIds }, activo: true });
      const transIds = new Set(transEncontrados.map(t => String(t._id)));
      const idsNoEncontrados = transportistaIds.filter(id => !transIds.has(String(id)));

      // Los IDs que no están en Transportista, buscarlos en Chofer
      const choferesEncontrados = idsNoEncontrados.length > 0
        ? await Chofer.find({ _id: { $in: idsNoEncontrados }, activa: { $ne: false } })
        : [];

      // Normalizar transportistas al mismo interface
      const transNorm = transEncontrados.map(t => ({
        _id: t._id,
        nombre: t.razonSocial,
        razonSocial: t.razonSocial,
        nombreConductor: t.nombreConductor || t.razonSocial,
        numeroWhatsapp: t.numeroWhatsapp,
        _coleccion: 'transportista',
        _doc: t,
      }));
      const choferNorm = choferesEncontrados.map(c => ({
        _id: c._id,
        nombre: c.nombre,
        numeroWhatsapp: c.telefono,
        nombreConductor: c.nombre,
        razonSocial: c.nombre,
        _coleccion: 'chofer',
        _doc: c,
      }));
      destinatarios = [...transNorm, ...choferNorm];
    } else {
      const transportistas = await Transportista.find({ activo: true, disponible: true });
      destinatarios = transportistas.map(t => ({
        _id: t._id,
        nombre: t.razonSocial,
        numeroWhatsapp: t.numeroWhatsapp,
        _coleccion: 'transportista',
        _doc: t,
      }));
    }

    if (destinatarios.length === 0) {
      return res.status(404).json({ message: 'No hay transportistas disponibles' });
    }

    const results = [];
    for (const dest of destinatarios) {
      try {
        await whatsappService.sendTripOffer(dest, viaje);

        // Crear sesión con número normalizado
        const sessionPhone = normalizePhone(dest.numeroWhatsapp);
        await WhatsAppSession.create({
          phoneNumber: sessionPhone,
          transportistaId: dest._coleccion === 'transportista' ? dest._id : undefined,
          choferId: dest._coleccion === 'chofer' ? dest._id : undefined,
          viajeId: viaje._id,
          status: 'waiting_response',
          context: 'trip_offer'
        });

        results.push({ transportista: dest.nombre, success: true });
      } catch (error) {
        console.error(`Error enviando a ${dest.nombre}:`, error);
        results.push({ transportista: dest.nombre, success: false, error: error.message });
      }
    }

    viaje.estado = 'buscando_camiones';
    await viaje.save();

    res.json({ 
      message: `Ofertas procesadas`,
      results,
      total: destinatarios.length,
      successful: results.filter(r => r.success).length
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const handleWebhook = async (req, res) => {
  try {
    const { 
      MessageSid, 
      From, 
      To, 
      Body, 
      Latitude, 
      Longitude,
      MediaUrl0,
      MediaContentType0
    } = req.body;

    const phoneNumber = From.replace('whatsapp:', '');

    console.log('📱 Mensaje recibido de WhatsApp:');
    console.log('  From:', From);
    console.log('  Phone:', phoneNumber);
    console.log('  Body:', Body);

    // Guardar mensaje entrante
    await WhatsAppMessage.create({
      messageId: MessageSid,
      direction: 'inbound',
      from: From,
      to: To,
      body: Body,
      mediaUrl: MediaUrl0,
      mediaType: MediaContentType0,
      location: (Latitude && Longitude) ? {
        latitude: parseFloat(Latitude),
        longitude: parseFloat(Longitude)
      } : undefined
    });

    // Normalizar número entrante para comparar con BD
    const incomingNorm = normalizePhone(phoneNumber);

    let destinatario = null;

    // Buscar en Transportistas comparando normalizado
    const allTrans = await Transportista.find({ activo: true }, 'razonSocial nombreConductor numeroWhatsapp');
    const trans = allTrans.find(t => normalizePhone(t.numeroWhatsapp) === incomingNorm);
    if (trans) {
      destinatario = {
        _id: trans._id,
        nombre: trans.razonSocial,
        razonSocial: trans.razonSocial,
        nombreConductor: trans.nombreConductor || trans.razonSocial,
        numeroWhatsapp: trans.numeroWhatsapp,
        _coleccion: 'transportista',
        _doc: trans,
      };
    }

    // Si no se encontró, buscar en Choferes
    if (!destinatario) {
      const allChoferes = await Chofer.find({ activa: { $ne: false } }, 'nombre telefono');
      const chofer = allChoferes.find(c => normalizePhone(c.telefono) === incomingNorm);
      if (chofer) {
        destinatario = {
          _id: chofer._id,
          nombre: chofer.nombre,
          razonSocial: chofer.nombre,
          nombreConductor: chofer.nombre,
          numeroWhatsapp: chofer.telefono,
          _coleccion: 'chofer',
          _doc: chofer,
        };
      }
    }

    if (!destinatario) {
      console.log(`❌ Número desconocido: ${phoneNumber} (normalizado: ${incomingNorm})`);
      return res.status(200).send('OK');
    }

    return await processWebhookMessage(req, res, destinatario, phoneNumber);
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(200).send('OK');
  }
};

// Procesar mensaje del webhook
async function processWebhookMessage(req, res, destinatario, phoneNumber) {
  const { Body, Latitude, Longitude } = req.body;

  const sessionPhone = normalizePhone(destinatario.numeroWhatsapp);
  const session = await WhatsAppSession.findOne({
    phoneNumber: sessionPhone,
    status: { $in: ['active', 'waiting_response', 'waiting_location'] }
  }).sort({ createdAt: -1 });

  console.log('  Sesión encontrada:', session ? `${session.context} (${session.status})` : 'NO ENCONTRADA');

  if (Latitude && Longitude) {
    await handleLocationReceived(session, destinatario, Latitude, Longitude);
    return res.status(200).send('OK');
  }

  if (!session) {
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `Hola! No tenés ninguna conversación activa en este momento. Cuando haya un nuevo viaje disponible te avisamos. 🚚`
    );
    return res.status(200).send('OK');
  }

  const parsed = whatsappService.parseIncomingMessage(Body || '', session?.context);
  console.log('  Mensaje parseado:', parsed);

  if (session?.context === 'waiting_truck_count') {
    await handleTruckCountResponse(session, destinatario, Body);
  } else if (parsed.type === 'offer_full_trucks') {
    await handleOfferFullTrucks(session, destinatario, parsed.count);
  } else if (parsed.type === 'offer_fewer_trucks') {
    await handleOfferFewerTrucks(session, destinatario);
  } else if (parsed.type === 'trip_rejection') {
    await handleTripRejection(session, destinatario);
  } else if (parsed.type === 'check_in') {
    await handleCheckIn(session, destinatario, parsed.status);
  } else {
    console.log(`Mensaje no reconocido de ${destinatario.nombre}: ${Body}`);
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `No entendí tu respuesta. Por favor respondé con:\n1️⃣ Tengo los camiones disponibles\n2️⃣ Tengo menos camiones disponibles\n3️⃣ No tengo disponibilidad`
    );
  }

  return res.status(200).send('OK');
}

// --- Handlers del flujo de oferta ---

// Transportista responde "Tengo XX camiones disponibles" (cantidad exacta o completa)
async function handleOfferFullTrucks(session, destinatario, count) {
  if (!session?.viajeId) return;
  const viaje = await Viaje.findById(session.viajeId);
  if (!viaje) return;

  const viajeAbierto = viaje.estado !== 'documentacion' && viaje.estado !== 'en_curso' && viaje.estado !== 'finalizado';
  const cantidad = count || viaje.camionesSolicitados;

  session.metadata = { ...(session.metadata || {}), camionesCometidos: cantidad };
  session.status = 'completed';
  const saved = await session.save();
  console.log(`✅ Sesión ${session._id} marcada completed, status en BD: ${saved.status}`);

  if (viajeAbierto) {
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `Se registró la reserva del cupo de tus camiones. A la brevedad nos pondremos en contacto para coordinar.`
    );
  } else {
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `Este viaje ya fue asignado. Pronto saldrán nuevas oportunidades.`
    );
  }
}

// Transportista responde "Tengo menos camiones disponibles"
async function handleOfferFewerTrucks(session, destinatario) {
  if (!session?.viajeId) return;
  session.context = 'waiting_truck_count';
  session.status = 'active';
  await session.save();
  await whatsappService.sendMessage(
    destinatario.numeroWhatsapp,
    `¿Qué cantidad de camiones tenés disponibles? Ingresá sólo el número.`
  );
}

// Transportista responde con número cuando se le preguntó cuántos tiene
async function handleTruckCountResponse(session, destinatario, body) {
  const count = parseInt((body || '').trim(), 10);
  if (isNaN(count) || count <= 0) {
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `Por favor ingresá solo un número válido. ¿Cuántos camiones tenés disponibles?`
    );
    return;
  }

  const viaje = await Viaje.findById(session.viajeId);
  if (!viaje) return;

  const viajeAbierto = viaje.estado !== 'documentacion' && viaje.estado !== 'en_curso' && viaje.estado !== 'finalizado';

  session.metadata = { ...(session.metadata || {}), camionesCometidos: count };
  session.context = 'trip_offer';
  session.status = 'completed';
  await session.save();

  if (viajeAbierto) {
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `Se registró la reserva del cupo de tus camiones. A la brevedad nos pondremos en contacto para coordinar.`
    );
  } else {
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `Este viaje ya fue asignado. Pronto saldrán nuevas oportunidades.`
    );
  }
}

async function handleTripRejection(session, transportista) {
  if (!session || !session.viajeId) {
    return;
  }

  await whatsappService.sendMessage(
    transportista.numeroWhatsapp,
    '✅ Entendido. Gracias por tu respuesta.'
  );

  session.status = 'completed';
  await session.save();
}

async function handleCheckIn(session, transportista, status) {
  if (!session || !session.viajeId) {
    await whatsappService.sendMessage(
      transportista.numeroWhatsapp,
      '❌ No hay un viaje activo para reportar.'
    );
    return;
  }

  const viaje = await Viaje.findById(session.viajeId);
  if (!viaje) {
    return;
  }

  const statusMap = {
    'llegue_a_cargar': 'Llegué a cargar',
    'cargado_saliendo': 'Cargado, saliendo',
    'en_camino': 'En camino',
    'llegue_a_destino': 'Llegué a destino',
    'descargado': 'Descargado'
  };

  // Agregar check-in al viaje
  if (!viaje.checkIns) {
    viaje.checkIns = [];
  }

  viaje.checkIns.push({
    tipo: status,
    descripcion: statusMap[status],
    fecha: new Date()
  });

  // Actualizar estado y sub-estado del viaje según el check-in
  if (status === 'llegue_a_cargar') {
    viaje.estado = 'en_curso';
    viaje.subEstado = 'llegue_a_cargar';
  } else if (status === 'cargado_saliendo') {
    viaje.estado = 'en_curso';
    viaje.subEstado = 'cargado_saliendo';
  } else if (status === 'en_camino') {
    viaje.estado = 'en_curso';
    viaje.subEstado = 'en_camino';
  } else if (status === 'llegue_a_destino') {
    viaje.estado = 'en_curso';
    viaje.subEstado = 'llegue_a_destino';
  } else if (status === 'descargado') {
    viaje.estado = 'finalizado';
    viaje.subEstado = 'descargado';
  }

  await viaje.save();

  // Enviar confirmación de check-in
  await whatsappService.sendMessage(
    transportista.numeroWhatsapp,
    `✅ *Check-in registrado*\n\n${statusMap[status]} - Viaje #${viaje.numeroViaje}`
  );

  // Si el viaje no está finalizado, enviar menú de check-in para el siguiente paso
  if (viaje.estado !== 'finalizado') {
    await whatsappService.sendCheckInMenu(transportista, viaje);
  } else {
    // Si el viaje está finalizado, cerrar la sesión
    await whatsappService.sendMessage(
      transportista.numeroWhatsapp,
      '🎉 *Viaje finalizado*\n\nGracias por completar el viaje. ¡Buen trabajo!'
    );
    session.status = 'completed';
  }

  // Mantener sesión activa para futuros check-ins
  session.status = viaje.estado === 'finalizado' ? 'completed' : 'active';
  await session.save();
}

async function handleLocationReceived(session, transportista, latitude, longitude) {
  if (!session || !session.viajeId) {
    return;
  }

  const viaje = await Viaje.findById(session.viajeId);
  if (!viaje) {
    return;
  }

  // Actualizar ubicación en el último check-in
  if (viaje.checkIns && viaje.checkIns.length > 0) {
    const lastCheckIn = viaje.checkIns[viaje.checkIns.length - 1];
    lastCheckIn.ubicacion = {
      latitud: parseFloat(latitude),
      longitud: parseFloat(longitude)
    };
    await viaje.save();
  }

  // Confirmar recepción
  const checkInType = session.metadata?.lastCheckIn || 'estado';
  await whatsappService.sendCheckInConfirmation(transportista, viaje, checkInType);

  // Volver sesión a activa
  session.status = 'active';
  session.metadata = {};
  await session.save();
}

export const sendCheckInReminder = async (req, res) => {
  try {
    const { tripId } = req.body;
    
    const viaje = await Viaje.findById(tripId).populate('transportista');
    if (!viaje || !viaje.transportista) {
      return res.status(404).json({ message: 'Viaje o transportista no encontrado' });
    }

    await whatsappService.sendCheckInMenu(viaje.transportista, viaje);

    res.json({ message: 'Recordatorio enviado' });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const sendTripUpdate = async (req, res) => {
  try {
    const { tripId, message } = req.body;
    
    const viaje = await Viaje.findById(tripId).populate('transportista');
    if (!viaje || !viaje.transportista) {
      return res.status(404).json({ message: 'Viaje o transportista no encontrado' });
    }

    await whatsappService.sendTripUpdate(viaje.transportista, viaje, message);

    res.json({ message: 'Actualización enviada' });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

