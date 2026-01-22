import express from 'express';
import {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  updateTripStatus,
  assignTransportista,
  addCheckIn,
  updateLocation,
  proposePrice,
  deleteTrip
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
router.post('/:id/assign', authorize('superadmin', 'operador'), assignTransportista);
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
