import twilio from 'twilio';

class WhatsAppService {
  constructor() {
    this.client = null;
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  }

  getClient() {
    if (!this.client) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      
      if (!sid || !token || sid === 'TU_ACCOUNT_SID_AQUI' || token === 'TU_AUTH_TOKEN_AQUI') {
        console.warn('⚠️ Twilio no configurado correctamente. WhatsApp Bot deshabilitado.');
        return null;
      }
      
      this.client = twilio(sid, token);
    }
    return this.client;
  }

  formatPhoneNumber(phone) {
    // Limpiar el número
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    
    // Si ya tiene el formato whatsapp:, verificar el 9
    if (cleanPhone.startsWith('whatsapp:')) {
      cleanPhone = cleanPhone.replace('whatsapp:', '');
    }
    
    // Remover + si existe
    if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    // Para Argentina (54), asegurar que tenga el 9 después del código de país
    if (cleanPhone.startsWith('54')) {
      // Si no tiene el 9 después del 54, agregarlo
      if (!cleanPhone.startsWith('549')) {
        cleanPhone = '549' + cleanPhone.substring(2);
      }
    } else if (cleanPhone.startsWith('11')) {
      // Si empieza con 11 (código de área de Buenos Aires), agregar 549
      cleanPhone = '549' + cleanPhone;
    }
    
    return `whatsapp:+${cleanPhone}`;
  }

  async sendMessage(to, body) {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Twilio no está configurado. Verifica TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env');
      }

      const formattedTo = this.formatPhoneNumber(to);
      const message = await client.messages.create({
        from: this.fromNumber,
        to: formattedTo,
        body
      });
      console.log(`WhatsApp enviado a ${formattedTo}: ${message.sid}`);
      return { success: true, messageId: message.sid };
    } catch (error) {
      console.error('Error al enviar WhatsApp:', error);
      throw error;
    }
  }

  async sendTripOffer(transportista, viaje) {
    const message = this.buildTripOfferMessage(transportista, viaje);
    return await this.sendMessage(transportista.numeroWhatsapp, message);
  }

  buildTripOfferMessage(transportista, viaje) {
    const origen = viaje.origen?.ciudad || 'No especificado';
    const destino = viaje.destino?.ciudad || 'No especificado';
    const fecha = viaje.fechaProgramada ? new Date(viaje.fechaProgramada).toLocaleDateString('es-AR') : 'No especificada';
    const precio = viaje.precios?.precioConfirmado || viaje.precios?.precioBase || 0;
    const carga = viaje.tipoCarga || 'grano';
    const peso = viaje.peso || 0;

    return `🚚 *Nueva Oferta de Viaje #${viaje.numeroViaje}*

📍 *Origen:* ${origen}, ${viaje.origen?.provincia || ''}
📍 *Destino:* ${destino}, ${viaje.destino?.provincia || ''}
📅 *Fecha:* ${fecha}
💰 *Pago:* $${precio.toLocaleString('es-AR')}
📦 *Carga:* ${carga} - ${peso} tn

Hola ${transportista.nombreConductor},

Tenemos un viaje disponible para vos.

*Responde con:*
1️⃣ - Confirmo
2️⃣ - No tengo disponibilidad

_Viaje ID: ${viaje._id}_`;
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

  parseIncomingMessage(body, sessionContext) {
    const text = body.trim().toLowerCase();
    
    // Si el contexto es check_in, interpretar números como check-ins
    if (sessionContext === 'check_in') {
      const checkInMap = {
        '1': 'llegue_a_cargar',
        '2': 'cargado_saliendo',
        '3': 'en_camino',
        '4': 'llegue_a_destino',
        '5': 'descargado'
      };

      if (checkInMap[text]) {
        return { type: 'check_in', status: checkInMap[text] };
      }
    }
    
    // Si el contexto es trip_offer, interpretar números como confirmación/rechazo
    if (sessionContext === 'trip_offer') {
      if (text === '1' || text.includes('confirmo')) {
        return { type: 'trip_confirmation', trucks: 1 };
      }
      if (text === '2' || text.includes('no tengo')) {
        return { type: 'trip_rejection' };
      }
    }

    // Fallback: detectar por palabras clave
    if (text.includes('confirmo')) {
      return { type: 'trip_confirmation', trucks: 1 };
    }
    if (text.includes('no tengo')) {
      return { type: 'trip_rejection' };
    }

    return { type: 'unknown', text };
  }
}

export default new WhatsAppService();
