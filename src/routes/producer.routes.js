import express from 'express';
import {
  createProducer,
  getProducers,
  getProducerById,
  updateProducer,
  deleteProducer
} from '../controllers/producer.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', authorize(['superadmin', 'operador']), createProducer);
router.get('/', getProducers);
router.get('/:id', getProducerById);
router.put('/:id', authorize(['superadmin', 'operador']), updateProducer);
router.delete('/:id', authorize(['superadmin']), deleteProducer);

export default router;
