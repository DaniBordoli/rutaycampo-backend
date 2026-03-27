// Gestiona los Content Templates de Twilio para mensajes interactivos de WhatsApp.
// Los templates se crean una sola vez en Twilio y sus SIDs se cachean en memoria.
// Si la Content API no está disponible, el servicio cae silenciosamente a texto plano.

const TEMPLATE_DEFS = [
  {
    key: 'tripOffer',
    friendlyName: 'ruta_trip_offer_v1',
    actions: [
      { title: 'Tengo todos', id: 'offer_full' },
      { title: 'Tengo menos', id: 'offer_fewer' },
      { title: 'Sin disponibilidad', id: 'offer_none' },
    ],
  },
  {
    key: 'llegueAOrigen',
    friendlyName: 'ruta_tripstarting_v1',
    actions: [{ title: 'Llegué a origen', id: 'checkin_confirm' }],
  },
  {
    key: 'cargado',
    friendlyName: 'ruta_checkin_cargado_v1',
    actions: [{ title: 'Carga realizada', id: 'checkin_confirm' }],
  },
  {
    key: 'iniciado',
    friendlyName: 'ruta_checkin_iniciado_v1',
    actions: [{ title: 'Comienzo el viaje', id: 'checkin_confirm' }],
  },
  {
    key: 'en_destino',
    friendlyName: 'ruta_checkin_endestino_v1',
    actions: [{ title: 'Llegué a destino', id: 'checkin_confirm' }],
  },
  {
    key: 'finalizado',
    friendlyName: 'ruta_checkin_finalizado_v1',
    actions: [{ title: 'Camión descargado', id: 'checkin_confirm' }],
  },
];

class WhatsAppTemplateManager {
  constructor() {
    this.sids = {};
    this._initPromise = null;
  }

  // Inicialización lazy: solo se ejecuta una vez; los reintentos se habilitan si falla.
  init(client) {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit(client).catch(err => {
      console.warn('⚠️  Templates WhatsApp no inicializados, se usará texto plano:', err.message);
      this._initPromise = null; // habilita reintento en el próximo arranque
    });
    return this._initPromise;
  }

  async _doInit(client) {
    const existing = await client.content.v1.contents.list({ limit: 200 });
    const byName = {};
    existing.forEach(c => { byName[c.friendlyName] = c.sid; });

    for (const tpl of TEMPLATE_DEFS) {
      if (byName[tpl.friendlyName]) {
        this.sids[tpl.key] = byName[tpl.friendlyName];
        console.log(`📋 Template WA ya existe: ${tpl.friendlyName} → ${this.sids[tpl.key]}`);
      } else {
        const created = await client.content.v1.contents.create({
          friendlyName: tpl.friendlyName,
          language: 'es',
          variables: { '1': 'placeholder' },
          types: {
            'twilio/quick-reply': {
              body: '{{1}}',
              actions: tpl.actions,
            },
          },
        });
        this.sids[tpl.key] = created.sid;
        console.log(`✅ Template WA creado: ${tpl.friendlyName} → ${created.sid}`);
      }
    }
  }

  getSid(key) {
    return this.sids[key] || null;
  }
}

export default new WhatsAppTemplateManager();
