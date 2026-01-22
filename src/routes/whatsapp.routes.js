import express from 'express';
import { 
  sendOfferToCarriers, 
  handleWebhook, 
  sendCheckInReminder,
  sendTripUpdate 
} from '../controllers/whatsapp.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Enviar oferta de viaje a transportistas
router.post('/send-offer', authenticate, sendOfferToCarriers);

// Webhook para recibir mensajes de Twilio
router.post('/webhook', handleWebhook);

// Enviar recordatorio de check-in
router.post('/send-reminder', authenticate, sendCheckInReminder);

// Enviar actualización de viaje
router.post('/send-update', authenticate, sendTripUpdate);

export default router;
