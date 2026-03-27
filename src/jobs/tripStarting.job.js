import cron from 'node-cron';
import Viaje from '../models/Viaje.model.js';
import Transportista from '../models/Transportista.model.js';
import Chofer from '../models/Chofer.model.js';
import WhatsAppSession from '../models/WhatsAppSession.model.js';
import whatsappService from '../services/whatsapp.service.js';
import { normalizePhone } from '../controllers/whatsapp.controller.js';

const MARGEN_MINUTOS = 30;

async function dispararTripStarting(viaje) {
  const ids = [...new Set(
    viaje.camionesAsignados
      .map(c => c.transportista)
      .filter(Boolean)
      .map(t => String(typeof t === 'object' ? t._id : t))
  )];

  const transportistas = await Transportista.find({ _id: { $in: ids } });
  const choferes = await Chofer.find({ _id: { $in: ids } });

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

  for (const destinatario of destinatarios) {
    if (!destinatario.numeroWhatsapp) continue;
    try {
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

      console.log(`  ✅ Notificación enviada a ${destinatario.nombre}`);
    } catch (err) {
      console.error(`  ❌ Error enviando a ${destinatario.nombre}:`, err.message);
    }
  }

  viaje.tripStartingNotified = true;
  await viaje.save();
}

export const startTripStartingJob = () => {
  console.log('='.repeat(60));
  console.log('🚛 Iniciando Job de Notificación de Inicio de Viaje');
  console.log(`⏰ Frecuencia: Cada ${MARGEN_MINUTOS} minutos`);
  console.log('='.repeat(60));

  cron.schedule(`*/${MARGEN_MINUTOS} * * * *`, async () => {
    const now = new Date();
    const desde = new Date(now.getTime() - MARGEN_MINUTOS * 60 * 1000);

    const viajes = await Viaje.find({
      estado: 'confirmado',
      tripStartingNotified: { $ne: true },
      fechaProgramada: { $lte: now, $gte: desde },
      'camionesAsignados.0': { $exists: true },
    });

    if (viajes.length === 0) return;

    console.log(`\n🚛 [TripStartingJob] ${viajes.length} viaje(s) por iniciar - ${now.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);

    for (const viaje of viajes) {
      console.log(`  → Viaje #${viaje.numeroViaje}`);
      await dispararTripStarting(viaje);
    }
  });
};
