import cron from 'node-cron';
import { checkAndReactivateTransportistas } from '../controllers/transportista.controller.js';

export const startReactivationJob = () => {
  console.log('='.repeat(60));
  console.log('🚀 Iniciando Job de Reactivación de Transportistas');
  console.log('⏰ Frecuencia: Cada 1 hora');
  console.log('📅 Hora de inicio:', new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }));
  console.log('='.repeat(60));

  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    console.log('\n' + '='.repeat(60));
    console.log('⏰ EJECUTANDO JOB DE REACTIVACIÓN');
    console.log('📅 Fecha/Hora:', now.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }));
    console.log('🔍 Buscando transportistas para reactivar...');
    
    const reactivated = await checkAndReactivateTransportistas();
    
    if (reactivated > 0) {
      console.log(`✅ ${reactivated} transportista(s) reactivado(s) automáticamente`);
    } else {
      console.log('ℹ️  No hay transportistas para reactivar en este momento');
    }
    console.log('='.repeat(60) + '\n');
  });
};
