import express from 'express';
import {
  getRutaCompleta,
  getSlotByToken,
  updateSlotLocation,
} from '../controllers/tracking.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rutas autenticadas (para dashboard)
router.get('/:id/ruta', authenticate, getRutaCompleta);

// Rutas públicas (para PWA de tracking - usan token del slot)
router.get('/slot/:token', getSlotByToken);
router.post('/slot/:token/location', updateSlotLocation);

export default router;
