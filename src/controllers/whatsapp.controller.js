import Viaje from '../models/Viaje.model.js';
import Transportista from '../models/Transportista.model.js';
import WhatsAppSession from '../models/WhatsAppSession.model.js';
import WhatsAppMessage from '../models/WhatsAppMessage.model.js';
import whatsappService from '../services/whatsapp.service.js';
import { sanitizeError } from '../utils/sanitizeError.js';


export const sendOfferToCarriers = async (req, res) => {
  try {
    const { tripId, transportistaIds } = req.body;
    
    const viaje = await Viaje.findById(tripId).populate('productor');
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    let transportistas;
    if (transportistaIds && transportistaIds.length > 0) {
      transportistas = await Transportista.find({ 
        _id: { $in: transportistaIds },
        activo: true 
      });
    } else {
      transportistas = await Transportista.find({ 
        activo: true, 
        disponible: true 
      });
    }

    if (transportistas.length === 0) {
      return res.status(404).json({ 
        message: 'No hay transportistas disponibles' 
      });
    }

    const results = [];
    for (const transportista of transportistas) {
      try {
        const result = await whatsappService.sendTripOffer(transportista, viaje);
        
        // Crear sesión
        await WhatsAppSession.create({
          phoneNumber: transportista.numeroWhatsapp,
          transportistaId: transportista._id,
          viajeId: viaje._id,
          status: 'waiting_response',
          context: 'trip_offer'
        });

        results.push({ transportista: transportista.razonSocial, success: true });
      } catch (error) {
        console.error(`Error enviando a ${transportista.razonSocial}:`, error);
        results.push({ transportista: transportista.razonSocial, success: false, error: error.message });
      }
    }

    viaje.estado = 'en_asignacion';
    await viaje.save();

    res.json({ 
      message: `Ofertas procesadas`,
      results,
      total: transportistas.length,
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

    // Buscar transportista con múltiples variaciones del número
    // Variaciones posibles:
    // 1. +5491136174705 (lo que llega de WhatsApp)
    // 2. 5491136174705 (sin +)
    // 3. 1136174705 (solo número local, lo que está en BD)
    // 4. 541136174705 (sin el 9)
    
    const phoneVariations = [
      phoneNumber,                                    // +5491136174705
      phoneNumber.replace('+', ''),                   // 5491136174705
      phoneNumber.replace('+549', ''),                // 1136174705
      phoneNumber.replace('+54', ''),                 // 91136174705
      phoneNumber.replace('+5491', ''),               // 136174705
      phoneNumber.replace(/\D/g, '').slice(-10)       // últimos 10 dígitos
    ];

    let transportista = null;
    for (const variation of phoneVariations) {
      transportista = await Transportista.findOne({ numeroWhatsapp: variation });
      if (transportista) {
        console.log(`✅ Transportista encontrado: ${transportista.razonSocial} (formato: "${variation}")`);
        break;
      }
    }
    
    if (!transportista) {
      // Debug: Mostrar todos los números en la BD
      const allTransportistas = await Transportista.find({}, 'razonSocial numeroWhatsapp');
      console.log('📋 Números en BD:', allTransportistas.map(t => `${t.razonSocial}: "${t.numeroWhatsapp}"`));
      console.log('📋 Variaciones probadas:', phoneVariations);
      
      console.log(`❌ Mensaje de número desconocido: ${phoneNumber}`);
      return res.status(200).send('OK');
    }

    return await processWebhookMessage(req, res, transportista, phoneNumber);
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(200).send('OK');
  }
};

// Procesar mensaje del webhook
async function processWebhookMessage(req, res, transportista, phoneNumber) {
  const { Body, Latitude, Longitude } = req.body;

  // Buscar sesión activa usando el número del transportista en la BD
  const session = await WhatsAppSession.findOne({
    phoneNumber: transportista.numeroWhatsapp,
    status: { $in: ['active', 'waiting_response', 'waiting_location'] }
  }).sort({ createdAt: -1 });

  console.log('  Buscando sesión con número:', transportista.numeroWhatsapp);
  console.log('  Sesión encontrada:', session ? `${session.context} (${session.status})` : 'NO ENCONTRADA');

  // Parsear mensaje con contexto de sesión
  const parsed = whatsappService.parseIncomingMessage(Body || '', session?.context);
  console.log('  Mensaje parseado:', parsed);

  // Manejar ubicación
  if (Latitude && Longitude) {
    await handleLocationReceived(session, transportista, Latitude, Longitude);
    return res.status(200).send('OK');
  }

  // Nota: Ya no requerimos ubicación obligatoria en check-ins

  // Manejar según tipo de mensaje
  if (parsed.type === 'trip_confirmation') {
    await handleTripConfirmation(session, transportista, parsed.trucks);
  } else if (parsed.type === 'trip_rejection') {
    await handleTripRejection(session, transportista);
  } else if (parsed.type === 'check_in') {
    await handleCheckIn(session, transportista, parsed.status);
  } else {
    console.log(`Mensaje no reconocido de ${transportista.razonSocial}: ${Body}`);
  }

  return res.status(200).send('OK');
}

// Funciones auxiliares para manejar respuestas
async function handleTripConfirmation(session, transportista, trucks) {
  if (!session || !session.viajeId) {
    await whatsappService.sendMessage(
      transportista.numeroWhatsapp,
      '❌ No hay una oferta de viaje activa para confirmar.'
    );
    return;
  }

  const viaje = await Viaje.findById(session.viajeId);
  if (!viaje) {
    await whatsappService.sendMessage(
      transportista.numeroWhatsapp,
      '❌ El viaje ya no está disponible.'
    );
    session.status = 'completed';
    await session.save();
    return;
  }

  // Verificar que el viaje no esté ya asignado a otro transportista
  if (viaje.transportista && viaje.transportista.toString() !== transportista._id.toString()) {
    await whatsappService.sendMessage(
      transportista.numeroWhatsapp,
      `❌ El viaje #${viaje.numeroViaje} ya fue asignado a otro transportista.`
    );
    session.status = 'completed';
    await session.save();
    return;
  }

  // Asignar transportista
  viaje.transportista = transportista._id;
  viaje.estado = 'confirmado';
  
  // Generar token de tracking si no existe
  if (!viaje.trackingToken) {
    const crypto = await import('crypto');
    viaje.trackingToken = crypto.randomBytes(32).toString('hex');
  }
  
  await viaje.save();

  // Enviar detalles completos con link de tracking
  await whatsappService.sendTripDetailsWithTracking(transportista, viaje);

  // Cerrar sesión de oferta
  session.status = 'completed';
  await session.save();

  // Crear nueva sesión para check-ins
  await WhatsAppSession.create({
    phoneNumber: transportista.numeroWhatsapp,
    transportistaId: transportista._id,
    viajeId: viaje._id,
    status: 'active',
    context: 'check_in'
  });
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

