import express from 'express';
import {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  updateTripStatus,
  assignTransportista,
  assignCamion,
  removeCamion,
  checkinCamion,
  addCheckIn,
  updateLocation,
  proposePrice,
  confirmarTarifa,
  deleteTrip,
  updateTruckDriver,
  updateTruckVehicle,
  updateTruckStatus,
  updateTruckDetail,
  checkYTransicionarConfirmado,
  recalcularEstado,
  rateTrip
} from '../controllers/trip.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload, uploadToSupabase } from '../middleware/upload.js';
import Viaje from '../models/Viaje.model.js';

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('productor', 'superadmin', 'operador'), createTrip);
router.get('/', getTrips);
router.get('/:id', getTripById);
router.put('/:id', authorize('superadmin', 'operador'), updateTrip);
router.patch('/:id/status', authorize('superadmin', 'operador'), updateTripStatus);
router.patch('/:id/propose-price', authorize('productor', 'superadmin', 'operador'), proposePrice);
router.patch('/:id/confirmar-tarifa', authorize('superadmin', 'operador'), confirmarTarifa);
router.post('/:id/assign', authorize('superadmin', 'operador'), assignTransportista);
router.post('/:id/camiones', authorize('superadmin', 'operador'), assignCamion);
router.delete('/:id/camiones/:camionId', authorize('superadmin', 'operador'), removeCamion);
router.patch('/:id/camiones/:truckId/transportista', authorize('superadmin', 'operador'), updateTruckDriver);
router.patch('/:id/camiones/:truckId/camion', authorize('superadmin', 'operador'), updateTruckVehicle);
router.patch('/:id/camiones/:truckId/status', authorize('superadmin', 'operador'), updateTruckStatus);
router.patch('/:id/camiones/:truckId/detalle', authorize('superadmin', 'operador'), updateTruckDetail);
router.post('/:id/camiones/:camionId/checkin', authorize('transportista', 'superadmin', 'operador'), checkinCamion);
router.post('/:id/checkin', authorize('transportista', 'superadmin', 'operador'), addCheckIn);
router.patch('/:id/location', authorize('transportista'), updateLocation);
router.delete('/:id', authorize('superadmin', 'operador'), deleteTrip);
router.patch('/:id/recalcular-estado', authorize('superadmin', 'operador'), recalcularEstado);
router.patch('/:id/rating', authorize('superadmin', 'operador', 'productor'), rateTrip);

router.post(
  '/:id/camiones/:camionId/upload/carta-porte',
  authorize('superadmin', 'operador', 'productor'),
  upload.single('cartaDePorte'),
  uploadToSupabase(process.env.SUPABASE_BUCKET || 'documentos'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No se recibió ningún archivo' });
      const viaje = await Viaje.findById(req.params.id);
      if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });
      const camion = viaje.camionesAsignados.id(req.params.camionId);
      if (!camion) return res.status(404).json({ message: 'Camión asignado no encontrado' });
      if (camion.cartaDePorte?.ruta) {
        const bucketName = process.env.SUPABASE_BUCKET || 'documentos';
        const supabaseUrl = process.env.SUPABASE_URL;
        const prefix = `${supabaseUrl}/storage/v1/object/public/${bucketName}/`;
        const oldFilename = camion.cartaDePorte.ruta.startsWith(prefix)
          ? camion.cartaDePorte.ruta.slice(prefix.length)
          : null;
        if (oldFilename) {
          const { createClient } = await import('@supabase/supabase-js');
          const client = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY);
          await client.storage.from(bucketName).remove([decodeURIComponent(oldFilename)]);
        }
      }

      camion.cartaDePorte = {
        nombreArchivo: req.file.originalname,
        ruta: req.file.publicUrl,
        fechaSubida: new Date()
      };
      checkYTransicionarConfirmado(viaje);
      await viaje.save();
      res.json({ message: 'Carta de porte subida exitosamente', cartaDePorte: camion.cartaDePorte, estado: viaje.estado });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.delete(
  '/:id/camiones/:camionId/carta-porte',
  authorize('superadmin', 'operador', 'productor'),
  async (req, res) => {
    try {
      const viaje = await Viaje.findById(req.params.id);
      if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });
      const camion = viaje.camionesAsignados.id(req.params.camionId);
      if (!camion) return res.status(404).json({ message: 'Camión asignado no encontrado' });
      if (!camion.cartaDePorte?.ruta) return res.status(404).json({ message: 'No hay carta de porte para eliminar' });

      const publicUrl = camion.cartaDePorte.ruta;
      const bucketName = process.env.SUPABASE_BUCKET || 'documentos';
      const supabaseUrl = process.env.SUPABASE_URL;
      const prefix = `${supabaseUrl}/storage/v1/object/public/${bucketName}/`;
      const filename = publicUrl.startsWith(prefix) ? publicUrl.slice(prefix.length) : null;

      if (filename) {
        const { createClient } = await import('@supabase/supabase-js');
        const client = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY);
        await client.storage.from(bucketName).remove([decodeURIComponent(filename)]);
      }

      camion.cartaDePorte = undefined;
      checkYTransicionarConfirmado(viaje);
      await viaje.save();
      res.json({ message: 'Carta de porte eliminada exitosamente', estado: viaje.estado });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.post(
  '/:id/upload/cupo',
  authorize('superadmin', 'operador', 'productor'),
  upload.single('cupo'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No se recibió ningún archivo' });
      const viaje = await Viaje.findById(req.params.id);
      if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });
      viaje.cupo = {
        nombreArchivo: req.file.originalname,
        ruta: req.file.path,
        fechaSubida: new Date()
      };
      await viaje.save();
      res.json({ message: 'Cupo subido exitosamente', cupo: viaje.cupo });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
