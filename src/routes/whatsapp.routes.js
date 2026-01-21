import express from 'express';
import {
  sendOfferToCarriers,
  handleWebhook,
  sendCheckInReminder
} from '../controllers/whatsapp.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/send-offer', authorize(['superadmin', 'operador']), sendOfferToCarriers);
router.post('/webhook', handleWebhook);
router.post('/send-reminder', authorize(['superadmin', 'operador']), sendCheckInReminder);

export default router;
