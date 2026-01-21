import twilio from 'twilio';
import Viaje from '../models/Viaje.model.js';
import Transportista from '../models/Transportista.model.js';

let client = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_ACCOUNT_SID !== 'your-twilio-account-sid') {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

export const sendOfferToCarriers = async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({ 
        message: 'WhatsApp no configurado. Configure TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env' 
      });
    }

    const { tripId } = req.body;
    
    const viaje = await Viaje.findById(tripId).populate('productor');
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    const transportistas = await Transportista.find({ 
      activo: true, 
      disponible: true 
    });

    if (transportistas.length === 0) {
      return res.status(404).json({ 
        message: 'No hay transportistas disponibles' 
      });
    }

    const message = `
🚛 *Nueva Oferta de Viaje*

📋 Viaje: ${viaje.numeroViaje}
📍 Origen: ${viaje.origen.ciudad}, ${viaje.origen.provincia}
📍 Destino: ${viaje.destino.ciudad}, ${viaje.destino.provincia}
📅 Fecha: ${viaje.fechaProgramada.toLocaleDateString()}
⚖️ Peso: ${viaje.peso} tn
🚚 Camiones: ${viaje.camionesSolicitados}

Para aceptar, responde:
*ACEPTO ${viaje.numeroViaje} [cantidad de camiones]*

Para rechazar:
*NO DISPONIBLE*
    `.trim();

    const promises = transportistas.map(transportista =>
      client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${transportista.telefono}`,
        body: message
      })
    );

    await Promise.all(promises);

    viaje.estado = 'en_asignacion';
    await viaje.save();

    res.json({ 
      message: `Ofertas enviadas a ${transportistas.length} transportistas`,
      sentTo: transportistas.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const handleWebhook = async (req, res) => {
  try {
    if (!client) {
      console.log('WhatsApp webhook recibido pero Twilio no está configurado');
      return res.status(200).send('OK');
    }

    const { From, Body } = req.body;
    const phoneNumber = From.replace('whatsapp:', '');
    const message = Body.trim().toUpperCase();

    const transportista = await Transportista.findOne({ telefono: phoneNumber });
    if (!transportista) {
      return res.status(200).send('OK');
    }

    if (message.startsWith('ACEPTO')) {
      const parts = message.split(' ');
      const numeroViaje = parts[1];
      const truckCount = parseInt(parts[2]) || 1;

      const viaje = await Viaje.findOne({ numeroViaje, estado: 'en_asignacion' });
      
      if (viaje && !viaje.transportista) {
        viaje.transportista = transportista._id;
        viaje.estado = 'en_curso';
        await viaje.save();

        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: From,
          body: `✅ Viaje ${numeroViaje} asignado exitosamente. Te enviaremos los detalles completos.`
        });
      } else {
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: From,
          body: `❌ El viaje ${numeroViaje} ya fue asignado a otro transportista.`
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(200).send('OK');
  }
};

export const sendCheckInReminder = async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({ 
        message: 'WhatsApp no configurado. Configure TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env' 
      });
    }

    const { tripId } = req.body;
    
    const viaje = await Viaje.findById(tripId).populate('transportista');
    if (!viaje || !viaje.transportista) {
      return res.status(404).json({ message: 'Viaje o transportista no encontrado' });
    }

    const message = `
🔔 *Recordatorio de Check-in*

Viaje: ${viaje.numeroViaje}

Por favor, reporta tu estado actual:
1️⃣ LLEGUE A CARGAR
2️⃣ CARGADO
3️⃣ SALI
4️⃣ DESCARGUE
    `.trim();

    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${viaje.transportista.telefono}`,
      body: message
    });

    res.json({ message: 'Recordatorio enviado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
