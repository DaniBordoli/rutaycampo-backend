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
  updateTruckStatus
} from '../controllers/trip.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

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
router.post('/:id/camiones/:camionId/checkin', authorize('transportista', 'superadmin', 'operador'), checkinCamion);
router.post('/:id/checkin', authorize('transportista', 'superadmin', 'operador'), addCheckIn);
router.patch('/:id/location', authorize('transportista'), updateLocation);
router.delete('/:id', authorize('superadmin', 'operador'), deleteTrip);

router.post(
  '/:id/upload/carta-porte',
  upload.single('cartaDePorte'),
  async (req, res) => {
    try {
      const trip = await Trip.findById(req.params.id);
      if (!trip) {
        return res.status(404).json({ message: 'Viaje no encontrado' });
      }

      trip.cartaDePorte = {
        filename: req.file.originalname,
        path: req.file.path,
        uploadedAt: new Date()
      };

      await trip.save();
      res.json({ message: 'Carta de porte subida exitosamente', trip });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.post(
  '/:id/upload/cupo',
  upload.single('cupo'),
  async (req, res) => {
    try {
      const trip = await Trip.findById(req.params.id);
      if (!trip) {
        return res.status(404).json({ message: 'Viaje no encontrado' });
      }

      trip.cupo = {
        filename: req.file.originalname,
        path: req.file.path,
        uploadedAt: new Date()
      };

      await trip.save();
      res.json({ message: 'Cupo subido exitosamente', trip });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
