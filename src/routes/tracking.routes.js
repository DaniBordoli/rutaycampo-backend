import express from 'express';
import {
  generateTrackingToken,
  getViajeByToken,
  startTracking,
  stopTracking,
  updateLocation,
  getRutaCompleta
} from '../controllers/tracking.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rutas autenticadas (para dashboard)
router.post('/:id/generate-token', authenticate, generateTrackingToken);
router.get('/:id/ruta', authenticate, getRutaCompleta);

// Rutas públicas (para PWA de tracking - usan token en lugar de auth)
router.get('/viaje/:token', getViajeByToken);
router.post('/viaje/:token/start', startTracking);
router.post('/viaje/:token/stop', stopTracking);
router.post('/viaje/:token/location', updateLocation);

export default router;
