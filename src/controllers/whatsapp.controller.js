import Viaje from '../models/Viaje.model.js';
import Transportista from '../models/Transportista.model.js';
import Chofer from '../models/Chofer.model.js';
import WhatsAppSession from '../models/WhatsAppSession.model.js';
import WhatsAppMessage from '../models/WhatsAppMessage.model.js';
import whatsappService from '../services/whatsapp.service.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import crypto from 'crypto';

// Normaliza cualquier número argentino a "549XXXXXXXXXX" (solo dígitos)
export function normalizePhone(phone) {
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
      ButtonPayload,
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
    if (ButtonPayload) console.log('  ButtonPayload:', ButtonPayload);

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

    return await processWebhookMessage(req, res, destinatario, phoneNumber, ButtonPayload);
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(200).send('OK');
  }
};

// Procesar mensaje del webhook
async function processWebhookMessage(req, res, destinatario, phoneNumber, buttonPayload) {
  const { Body } = req.body;

  const sessionPhone = normalizePhone(destinatario.numeroWhatsapp);
  const session = await WhatsAppSession.findOne({
    phoneNumber: sessionPhone,
    status: { $in: ['active', 'waiting_response', 'waiting_location'] }
  }).sort({ createdAt: -1 });

  console.log('  Sesión encontrada:', session ? `${session.context} (${session.status})` : 'NO ENCONTRADA');

  if (!session) {
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `Hola! No tenés ninguna conversación activa en este momento. Cuando haya un nuevo viaje disponible te avisamos. 🚚`
    );
    return res.status(200).send('OK');
  }

  const parsed = whatsappService.parseIncomingMessage(Body || '', session?.context, buttonPayload);
  console.log('  Mensaje parseado:', parsed);

  if (session?.context === 'trip_starting') {
    await handleLlegueAOrigen(session, destinatario, Body, buttonPayload);
  } else if (session?.context === 'check_in') {
    await handleCheckIn(session, destinatario, Body, buttonPayload);
  } else if (session?.context === 'waiting_truck_count') {
    await handleTruckCountResponse(session, destinatario, Body);
  } else if (parsed.type === 'offer_full_trucks') {
    await handleOfferFullTrucks(session, destinatario, parsed.count);
  } else if (parsed.type === 'offer_fewer_trucks') {
    await handleOfferFewerTrucks(session, destinatario);
  } else if (parsed.type === 'trip_rejection') {
    await handleTripRejection(session, destinatario);
  } else {
    console.log(`Mensaje no reconocido de ${destinatario.nombre}: ${Body}`);
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `No entendí tu respuesta. Por favor usá los botones o respondé con:\n1 - Tengo los camiones disponibles\n2 - Tengo menos camiones disponibles\n3 - No tengo disponibilidad`
    );
  }

  return res.status(200).send('OK');
}

// --- Handler de viaje por iniciar ---

async function handleLlegueAOrigen(session, destinatario, body, buttonPayload) {
  const isButtonConfirm = buttonPayload === 'checkin_confirm';
  const text = (body || '').trim().toLowerCase();
  const keywords = ['1', 'llegué a origen', 'llegue a origen', 'llegué', 'llegue', 'en origen'];
  const isConfirmation = isButtonConfirm || keywords.some(k => text === k || text.includes(k));

  if (!isConfirmation) {
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `No entendí tu respuesta. Usá el botón o respondé con:\n\n1 - Llegué a origen`
    );
    return;
  }

  if (!session?.viajeId) return;

  const viaje = await Viaje.findById(session.viajeId);
  if (!viaje) return;

  // Impactar en camionesAsignados: buscar el slot del camionero y actualizar subEstado
  const destinatarioId = String(destinatario._id);
  let slotActualizado = false;
  for (const slot of viaje.camionesAsignados) {
    const tId = String(typeof slot.transportista === 'object' ? slot.transportista?._id : slot.transportista);
    if (tId === destinatarioId) {
      slot.subEstado = 'en_origen';
      slot.checkIns = slot.checkIns || [];
      slot.checkIns.push({ tipo: 'en_origen', fechaHora: new Date() });
      slotActualizado = true;
      break;
    }
  }

  // Fallback: si no encontró por transportista, buscar por choferId
  if (!slotActualizado && destinatario._coleccion === 'chofer') {
    for (const slot of viaje.camionesAsignados) {
      if (!slot.transportista && slot.subEstado === 'asignado') {
        slot.subEstado = 'en_origen';
        slot.checkIns = slot.checkIns || [];
        slot.checkIns.push({ tipo: 'en_origen', fechaHora: new Date() });
        slotActualizado = true;
        break;
      }
    }
  }

  // Transición automática a en_curso cuando todos los slots están en_origen
  const totalSlots = viaje.camionesAsignados.length;
  const enOrigenCount = viaje.camionesAsignados.filter(s => {
    const ORDER = ['pendiente','asignado','en_origen','cargado','iniciado','en_destino','finalizado'];
    return ORDER.indexOf(s.subEstado) >= ORDER.indexOf('en_origen');
  }).length;
  if (totalSlots > 0 && enOrigenCount >= totalSlots) {
    viaje.estado = 'en_curso';
  }

  await viaje.save();

  // Enviar prompt del siguiente paso: carga
  await whatsappService.sendCheckInPrompt(destinatario, viaje, 'cargado');

  // Crear nueva sesión check_in para el paso cargado
  const sessionPhone = normalizePhone(destinatario.numeroWhatsapp);
  await WhatsAppSession.create({
    phoneNumber: sessionPhone,
    transportistaId: destinatario._coleccion === 'transportista' ? destinatario._id : undefined,
    choferId: destinatario._coleccion === 'chofer' ? destinatario._id : undefined,
    viajeId: viaje._id,
    status: 'waiting_response',
    context: 'check_in',
    metadata: { siguienteSubEstado: 'cargado' },
  });

  session.status = 'completed';
  await session.save();
}

// --- Handler de check-ins encadenados ---

const CHECK_IN_CHAIN = ['cargado', 'iniciado', 'en_destino', 'finalizado'];

async function handleCheckIn(session, destinatario, body, buttonPayload) {
  const siguienteSubEstado = session.metadata?.siguienteSubEstado;
  const isButtonConfirm = buttonPayload === 'checkin_confirm';
  const text = (body || '').trim().toLowerCase();

  if (!isButtonConfirm && text !== '1') {
    const label = {
      cargado:    'Carga realizada',
      iniciado:   'Comienzo el viaje',
      en_destino: 'Llegué a destino',
      finalizado: 'Camión descargado',
    }[siguienteSubEstado] || 'confirmar';
    await whatsappService.sendMessage(
      destinatario.numeroWhatsapp,
      `No entendí tu respuesta. Usá el botón o respondé:\n\n1 - ${label}`
    );
    return;
  }

  if (!session?.viajeId || !siguienteSubEstado) return;

  const viaje = await Viaje.findById(session.viajeId);
  if (!viaje) return;

  // Actualizar slot del camionero
  const destinatarioId = String(destinatario._id);
  let slotActualizado = null;
  for (const slot of viaje.camionesAsignados) {
    const tId = String(typeof slot.transportista === 'object' ? slot.transportista?._id : slot.transportista);
    if (tId === destinatarioId || (!slot.transportista && destinatario._coleccion === 'chofer')) {
      slot.subEstado = siguienteSubEstado;
      slot.checkIns = slot.checkIns || [];
      slot.checkIns.push({ tipo: siguienteSubEstado, fechaHora: new Date() });
      if (siguienteSubEstado === 'iniciado') {
        if (!slot.fechaInicio) slot.fechaInicio = new Date();
        if (!slot.trackingToken) slot.trackingToken = crypto.randomBytes(16).toString('hex');
      }
      if (siguienteSubEstado === 'finalizado') {
        if (!slot.fechaFin) slot.fechaFin = new Date();
        slot.trackingToken = null;
      }
      slotActualizado = slot;
      break;
    }
  }

  // Si todos finalizados → cerrar viaje
  if (siguienteSubEstado === 'finalizado') {
    const todosFinalizados = viaje.camionesAsignados.every(s => s.subEstado === 'finalizado');
    if (todosFinalizados) viaje.estado = 'finalizado';
  }

  await viaje.save();

  session.status = 'completed';
  await session.save();

  // Encadenar siguiente paso o cerrar
  const nextIdx = CHECK_IN_CHAIN.indexOf(siguienteSubEstado) + 1;
  if (nextIdx < CHECK_IN_CHAIN.length) {
    const nextSubEstado = CHECK_IN_CHAIN[nextIdx];
    // Si el siguiente prompt es en_destino, incluir el link de tracking del slot
    let trackingUrl = null;
    if (nextSubEstado === 'en_destino' && slotActualizado?.trackingToken) {
      const trackingBase = process.env.TRACKING_URL || 'http://localhost:5175';
      trackingUrl = `${trackingBase}/track/${slotActualizado.trackingToken}`;
    }
    await whatsappService.sendCheckInPrompt(destinatario, viaje, nextSubEstado, trackingUrl);
    const sessionPhone = normalizePhone(destinatario.numeroWhatsapp);
    await WhatsAppSession.create({
      phoneNumber: sessionPhone,
      transportistaId: destinatario._coleccion === 'transportista' ? destinatario._id : undefined,
      choferId: destinatario._coleccion === 'chofer' ? destinatario._id : undefined,
      viajeId: viaje._id,
      status: 'waiting_response',
      context: 'check_in',
      metadata: { siguienteSubEstado: nextSubEstado },
    });
  } else {
    await whatsappService.sendViajeCompletado(destinatario, viaje);
  }
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

export const sendTripStartingNotifications = async (req, res) => {
  try {
    const { tripId } = req.body;

    const viaje = await Viaje.findById(tripId);
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    if (!viaje.camionesAsignados || viaje.camionesAsignados.length === 0) {
      return res.status(400).json({ message: 'El viaje no tiene camiones asignados' });
    }

    console.log(`\n🚛 [sendTripStartingNotifications] Viaje #${viaje.numeroViaje}`);
    console.log(`  camionesAsignados (${viaje.camionesAsignados.length}):`);
    viaje.camionesAsignados.forEach((c, i) => {
      console.log(`    [${i}] transportista: ${JSON.stringify(c.transportista)} | subEstado: ${c.subEstado}`);
    });

    // Recolectar destinatarios únicos desde camionesAsignados
    const transportistaIds = [...new Set(
      viaje.camionesAsignados
        .map(c => c.transportista)
        .filter(Boolean)
        .map(t => String(typeof t === 'object' ? t._id : t))
    )];

    console.log(`  transportistaIds extraídos: ${JSON.stringify(transportistaIds)}`);

    // Buscar en Transportista Y en Chofer (el campo transportista puede referenciar cualquiera)
    const transportistas = await Transportista.find({ _id: { $in: transportistaIds } });
    const choferes = await Chofer.find({ _id: { $in: transportistaIds } });
    console.log(`  Transportistas encontrados: ${transportistas.length} | Choferes encontrados: ${choferes.length}`);
    transportistas.forEach(t => console.log(`    [T] ${t.razonSocial} | WA: ${t.numeroWhatsapp || 'SIN NÚMERO'}`));
    choferes.forEach(c => console.log(`    [C] ${c.nombre} | Tel: ${c.telefono || 'SIN NÚMERO'}`));

    // Unificar en lista de destinatarios normalizados
    const destinatarios = [
      ...transportistas.map(t => ({
        _id: t._id,
        nombre: t.razonSocial,
        razonSocial: t.razonSocial,
        nombreConductor: t.nombreConductor || t.razonSocial,
        numeroWhatsapp: t.numeroWhatsapp,
        _coleccion: 'transportista',
      })),
      ...choferes.map(c => ({
        _id: c._id,
        nombre: c.nombre,
        razonSocial: c.nombre,
        nombreConductor: c.nombre,
        numeroWhatsapp: c.telefono,
        _coleccion: 'chofer',
      })),
    ];

    const results = [];
    for (const destinatario of destinatarios) {
      if (!destinatario.numeroWhatsapp) {
        results.push({ nombre: destinatario.nombre, success: false, error: 'Sin número WhatsApp' });
        continue;
      }
      try {
        // Buscar la carta de porte del slot correspondiente
        const slot = viaje.camionesAsignados.find(s => {
          const sId = String(typeof s.transportista === 'object' ? s.transportista?._id : s.transportista);
          return sId === String(destinatario._id);
        });
        const cartaDePorteUrl = slot?.cartaDePorte?.ruta || null;
        const importeChofer = slot?.importeChofer || null;

        await whatsappService.sendTripStartingNotification(destinatario, viaje, cartaDePorteUrl, importeChofer);

        const sessionPhone = normalizePhone(destinatario.numeroWhatsapp);
        await WhatsAppSession.updateMany(
          { phoneNumber: sessionPhone, viajeId: viaje._id, status: { $in: ['active', 'waiting_response'] } },
          { status: 'completed' }
        );
        await WhatsAppSession.create({
          phoneNumber: sessionPhone,
          transportistaId: destinatario._coleccion === 'transportista' ? destinatario._id : undefined,
          choferId: destinatario._coleccion === 'chofer' ? destinatario._id : undefined,
          viajeId: viaje._id,
          status: 'waiting_response',
          context: 'trip_starting',
        });

        results.push({ nombre: destinatario.nombre, success: true });
      } catch (err) {
        results.push({ nombre: destinatario.nombre, success: false, error: err.message });
      }
    }

    res.json({
      message: 'Notificaciones enviadas',
      results,
      total: destinatarios.length,
      successful: results.filter(r => r.success).length,
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};


