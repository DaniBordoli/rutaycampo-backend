import express from 'express';
import { 
  sendOfferToCarriers, 
  handleWebhook, 
  getTripOffers,
  sendTripStartingNotifications
} from '../controllers/whatsapp.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Obtener ofertas recibidas de un viaje
router.get('/offers/:tripId', authenticate, getTripOffers);

// Enviar oferta de viaje a transportistas
router.post('/send-offer', authenticate, sendOfferToCarriers);

// Webhook para recibir mensajes de Twilio
router.post('/webhook', handleWebhook);

// Notificar a camioneros que el viaje está por iniciar
router.post('/send-trip-starting', authenticate, sendTripStartingNotifications);

export default router;
