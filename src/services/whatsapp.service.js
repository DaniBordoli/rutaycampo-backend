import twilio from 'twilio';
import templateManager from '../utils/whatsappTemplates.js';

const TRANSIENT_TWILIO_CODES = [20429, 20503, 30001, 30002, 30003, 30004, 30005, 30006];

class WhatsAppService {
  constructor() {
    this._client = null;
    this._misconfigured = false;
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  }

  getClient() {
    if (this._misconfigured) return null;
    if (!this._client) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      if (!sid || !token || sid === 'TU_ACCOUNT_SID_AQUI' || token === 'TU_AUTH_TOKEN_AQUI') {
        console.warn('⚠️  Twilio no configurado. WhatsApp deshabilitado.');
        this._misconfigured = true;
        return null;
      }
      this._client = twilio(sid, token);
    }
    return this._client;
  }

  formatPhoneNumber(phone) {
    // Quitar espacios, guiones y prefijo whatsapp:
    let n = phone.replace(/\s+|-/g, '').replace(/^whatsapp:/, '').replace(/^\+/, '');

    // Solo dígitos a partir de aquí
    n = n.replace(/\D/g, '');

    // Argentina: normalizar a 549XXXXXXXXXX (11 dígitos de área+número)
    if (n.startsWith('549')) {
      // ya correcto: 549XXXXXXXXXX
    } else if (n.startsWith('54')) {
      // 54XXXXXXXXXX → insertar 9
      n = '549' + n.slice(2);
    } else if (n.length === 10) {
      // XXXXXXXXXX (10 dígitos, sin código de país) → 549XXXXXXXXXX
      n = '549' + n;
    } else if (n.length === 8 || n.length === 7) {
      // número corto sin código de área → asumir GBA (11)
      n = '54911' + n;
    }

    return `whatsapp:+${n}`;
  }

  async sendMessage(to, body, retries = 2) {
    const client = this.getClient();
    if (!client) {
      throw new Error('Twilio no está configurado. Verificá TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env');
    }

    const formattedTo = this.formatPhoneNumber(to);
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const message = await client.messages.create({
          from: this.fromNumber,
          to: formattedTo,
          body,
        });
        console.log(`📤 WhatsApp → ${formattedTo} [${message.sid}]`);
        return { success: true, messageId: message.sid };
      } catch (error) {
        lastError = error;
        const isTransient = TRANSIENT_TWILIO_CODES.includes(error.code);
        if (isTransient && attempt < retries) {
          const delay = 500 * (attempt + 1);
          console.warn(`⚠️  Twilio error ${error.code}, reintentando en ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          break;
        }
      }
    }

    console.error(`❌ WhatsApp falló → ${formattedTo}:`, lastError?.message);
    throw lastError;
  }

  // Envía un mensaje con botones interactivos usando Twilio Content API.
  // Si el template no está disponible, cae a texto plano automáticamente.
  async sendInteractiveMessage(to, templateKey, bodyText, retries = 2) {
    const client = this.getClient();
    if (!client) {
      throw new Error('Twilio no está configurado. Verificá TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env');
    }

    await templateManager.init(client);
    const contentSid = templateManager.getSid(templateKey);

    if (!contentSid) {
      console.warn(`⚠️  Template "${templateKey}" no disponible, enviando texto plano`);
      return this.sendMessage(to, bodyText, retries);
    }

    const formattedTo = this.formatPhoneNumber(to);
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const message = await client.messages.create({
          from: this.fromNumber,
          to: formattedTo,
          contentSid,
          contentVariables: JSON.stringify({ '1': bodyText }),
        });
        console.log(`📤 WhatsApp [btn:${templateKey}] → ${formattedTo} [${message.sid}]`);
        return { success: true, messageId: message.sid };
      } catch (error) {
        lastError = error;
        const isTransient = TRANSIENT_TWILIO_CODES.includes(error.code);
        if (isTransient && attempt < retries) {
          const delay = 500 * (attempt + 1);
          console.warn(`⚠️  Twilio error ${error.code}, reintentando en ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          break;
        }
      }
    }

    console.error(`❌ WhatsApp interactive falló → ${formattedTo}:`, lastError?.message);
    throw lastError;
  }

  async sendTripOffer(transportista, viaje) {
    const message = this.buildTripOfferMessage(transportista, viaje);
    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  buildTripOfferMessage(transportista, viaje) {
    const origen = viaje.origen?.ciudad || 'No especificado';
    const destino = viaje.destino?.ciudad || 'No especificado';
    const fecha = viaje.fechaProgramada ? new Date(viaje.fechaProgramada).toLocaleDateString('es-AR') : 'No especificada';
    const precio = viaje.pagoChofer || viaje.precios?.precioConfirmado || viaje.precios?.precioBase || 0;
    const carga = viaje.tipoCarga || 'grano';
    const camiones = viaje.camionesSolicitados || 1;

    return `🚚 *¡Hay un nuevo viaje disponible!*

Hola ${transportista.nombreConductor || transportista.razonSocial},

📅 *Fecha:* ${fecha}
📍 *Origen:* ${origen}, ${viaje.origen?.provincia || ''}
📍 *Destino:* ${destino}, ${viaje.destino?.provincia || ''}
🚛 *Camiones:* ${camiones}
📦 *Producto:* ${carga}
💰 *Pago:* $${precio.toLocaleString('es-AR')}

¿Tenés disponibilidad?`;
  }

  async sendTripDetails(transportista, viaje) {
    const message = this.buildTripDetailsMessage(transportista, viaje);
    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  async sendTripDetailsWithTracking(transportista, viaje) {
    const trackingUrl = `${process.env.TRACKING_URL || 'http://localhost:5175'}/track/${viaje.trackingToken}`;
    
    const message = `✅ *Viaje Confirmado #${viaje.numeroViaje}*

Hola ${transportista.razonSocial},

Tu viaje ha sido confirmado. Aquí están los detalles completos:

📍 *Origen:* ${viaje.origen?.ciudad || 'No especificado'}, ${viaje.origen?.provincia || ''}
📍 *Destino:* ${viaje.destino?.ciudad || 'No especificado'}, ${viaje.destino?.provincia || ''}
📅 *Fecha:* ${viaje.fechaProgramada ? new Date(viaje.fechaProgramada).toLocaleDateString('es-AR') : 'No especificada'}
💰 *Pago:* $${(viaje.precios?.precioConfirmado || viaje.precios?.precioBase || 0).toLocaleString('es-AR')}
📦 *Carga:* ${viaje.tipoCarga || 'grano'} - ${viaje.peso || 0} tn

${viaje.notas ? `📝 *Notas:* ${viaje.notas}\n\n` : ''}🚚 *TRACKING EN TIEMPO REAL*

Abrí este link para activar el tracking GPS:
${trackingUrl}

*Recordá reportar los siguientes estados:*
1️⃣ - Llegué a cargar
2️⃣ - Cargado, saliendo
3️⃣ - En camino
4️⃣ - Llegué a destino
5️⃣ - Descargado`;

    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  buildTripDetailsMessage(transportista, viaje) {
    const origen = viaje.origen?.localidad || 'No especificado';
    const destino = viaje.destino?.localidad || 'No especificado';
    const fecha = new Date(viaje.fechaCarga).toLocaleDateString('es-AR');
    const precio = viaje.precioConfirmado || viaje.precioBase || 0;
    const carga = viaje.tipoCarga || 'No especificado';
    const peso = viaje.pesoTotal || 0;

    return `✅ *Viaje Confirmado #${viaje.numeroViaje}*

Hola ${transportista.razonSocial},

Tu viaje ha sido confirmado. Aquí están los detalles completos:

📍 *Origen:* ${origen}
📍 *Destino:* ${destino}
📅 *Fecha de carga:* ${fecha}
💰 *Pago acordado:* $${precio.toLocaleString('es-AR')}
📦 *Carga:* ${carga} - ${peso} tn

${viaje.notas ? `📝 *Notas:* ${viaje.notas}\n` : ''}
*Recordá reportar los siguientes estados:*
1️⃣ - Llegué a cargar
2️⃣ - Cargado, saliendo
3️⃣ - En camino
4️⃣ - Llegué a destino
5️⃣ - Descargado

_Viaje ID: ${viaje._id}_`;
  }

  async sendTripStartingNotification(destinatario, viaje, cartaDePorteUrl = null, importeChofer = null) {
    const fecha = viaje.fechaProgramada
      ? new Date(viaje.fechaProgramada).toLocaleDateString('es-AR')
      : 'próximamente';
    const origen = [viaje.origen?.ciudad, viaje.origen?.provincia].filter(Boolean).join(', ') || 'origen';
    const destino = [viaje.destino?.ciudad, viaje.destino?.provincia].filter(Boolean).join(', ') || 'destino';
    const nombre = destinatario.nombreConductor || destinatario.nombre || destinatario.razonSocial;

    const cartaLine = cartaDePorteUrl
      ? `\n📄 *Carta de porte:* ${cartaDePorteUrl}`
      : '';

    const importeLine = importeChofer
      ? `\n💰 *Precio por este viaje:* $${Number(importeChofer).toLocaleString('es-AR')}`
      : '';

    const message = `🚛 *Viaje #${viaje.numeroViaje} por iniciar*

Hola ${nombre},

Está por comenzar tu viaje el *${fecha}*.

📍 *Origen:* ${origen}
📍 *Destino:* ${destino}${importeLine}${cartaLine}

Cuando llegues al punto de origen respondé:

1️⃣ - Llegué a origen`;

    return await this.sendMessage(destinatario.numeroWhatsapp, message);
  }

  async sendCheckInPrompt(destinatario, viaje, siguienteSubEstado, trackingUrl = null) {
    const trackingLine = trackingUrl ? `\n\n📍 *Activá tu GPS de seguimiento:*\n${trackingUrl}` : '';
    const prompts = {
      cargado:    `✅ *Llegada a origen registrada*\n\nViaje #${viaje.numeroViaje}\n\nUsá el botón cuando cargues el total de la producción.`,
      iniciado:   `✅ *Carga registrada*\n\nViaje #${viaje.numeroViaje}\n\nUsá el botón cuando comiences el viaje.`,
      en_destino: `✅ *Inicio de viaje registrado*\n\nViaje #${viaje.numeroViaje}\n\n¡Buen viaje! 🚛${trackingLine}\n\nUsá el botón cuando llegues a destino.`,
      finalizado: `✅ *Llegada a destino registrada*\n\nViaje #${viaje.numeroViaje}\n\nUsá el botón cuando descargues el camión.`,
    };
    const msg = prompts[siguienteSubEstado];
    if (!msg) return;
    // siguienteSubEstado coincide exactamente con las keys del templateManager
    return await this.sendMessage(destinatario.numeroWhatsapp, msg);
  }

  async sendViajeCompletado(destinatario, viaje) {
    const message = `🎉 *¡Gracias!*\n\nTu viaje #${viaje.numeroViaje} fue realizado con éxito.\n\n¡Hasta el próximo viaje!`;
    return await this.sendMessage(destinatario.numeroWhatsapp, message);
  }

  async sendCheckInMenu(transportista, viaje) {
    // Mapear sub-estado a descripción legible
    const subEstadoLabels = {
      'llegue_a_cargar': '🚚 Llegué a cargar',
      'cargado_saliendo': '📦 Cargado, saliendo',
      'en_camino': '🛣️ En camino',
      'llegue_a_destino': '📍 Llegué a destino',
      'descargado': '✅ Descargado'
    };

    const estadoActual = viaje.subEstado 
      ? `\n*Estado actual:* ${subEstadoLabels[viaje.subEstado] || viaje.subEstado}\n`
      : '\n';

    const message = `📍 *Viaje #${viaje.numeroViaje}*

Hola ${transportista.nombreConductor},
${estadoActual}
*Reportá el estado del viaje:*

1️⃣ - Llegué a cargar
2️⃣ - Cargado, saliendo
3️⃣ - En camino
4️⃣ - Llegué a destino
5️⃣ - Descargado

_Viaje ID: ${viaje._id}_`;

    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  async requestLocation(transportista, viaje, checkInType) {
    const message = `📍 *Ubicación requerida*

Gracias por reportar: *${checkInType}*

Por favor, comparte tu ubicación actual para el seguimiento del viaje #${viaje.numeroViaje}.

_Usa el botón de adjuntar (📎) → Ubicación_`;

    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  async sendCheckInConfirmation(transportista, viaje, checkInType) {
    const message = `✅ *Check-in registrado*

Viaje #${viaje.numeroViaje}
Estado: *${checkInType}*

Gracias por mantener actualizado el estado del viaje.

_Viaje ID: ${viaje._id}_`;

    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  async sendTripCancellation(transportista, viaje, reason) {
    const message = `❌ *Viaje Cancelado #${viaje.numeroViaje}*

Hola ${transportista.razonSocial},

El viaje ha sido cancelado.

${reason ? `*Motivo:* ${reason}` : ''}

Cualquier consulta, contactá a Ruta y Campo.

_Viaje ID: ${viaje._id}_`;

    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  async sendTripUpdate(transportista, viaje, updateMessage) {
    const message = `🔄 *Actualización - Viaje #${viaje.numeroViaje}*

Hola ${transportista.razonSocial},

${updateMessage}

_Viaje ID: ${viaje._id}_`;

    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  parseIncomingMessage(body, sessionContext, buttonPayload) {
    // Botones interactivos: el payload es la fuente de verdad
    if (buttonPayload) {
      if (buttonPayload === 'offer_full')    return { type: 'offer_full_trucks', count: null };
      if (buttonPayload === 'offer_fewer')   return { type: 'offer_fewer_trucks' };
      if (buttonPayload === 'offer_none')    return { type: 'trip_rejection' };
      if (buttonPayload === 'checkin_confirm') return { type: 'check_in_confirm' };
    }

    const text = (body || '').trim().toLowerCase();

    // Fallback texto para check_in
    if (sessionContext === 'check_in') {
      if (text === '1') return { type: 'check_in_confirm' };
    }

    // Fallback texto para trip_offer
    if (sessionContext === 'trip_offer' || !sessionContext) {
      if (text === '1' || (text.includes('tengo') && text.includes('disponible') && !text.includes('menos'))) {
        const numMatch = text.match(/tengo\s+(\d+)\s+camion/);
        const count = numMatch ? parseInt(numMatch[1], 10) : null;
        return { type: 'offer_full_trucks', count };
      }
      if (text === '2' || (text.includes('menos') && text.includes('camion'))) {
        return { type: 'offer_fewer_trucks' };
      }
      if (text === '3' || text.includes('no tengo') || text.includes('sin disponibilidad') || text.includes('no hay')) {
        return { type: 'trip_rejection' };
      }
    }

    return { type: 'unknown', text };
  }
}

export default new WhatsAppService();
