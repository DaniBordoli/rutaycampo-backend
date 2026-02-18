import express from 'express';
import {
  createProducer,
  getProducers,
  getProducerById,
  updateProducer,
  toggleProducerActive,
  deleteProducer,
  createProducerAccess
} from '../controllers/producer.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', authorize(['superadmin', 'operador']), createProducer);
router.get('/', getProducers);
router.get('/:id', getProducerById);
router.put('/:id', authorize(['superadmin', 'operador']), updateProducer);
router.patch('/:id/toggle-active', authorize(['superadmin', 'operador']), toggleProducerActive);
router.delete('/:id', authorize(['superadmin']), deleteProducer);
router.post('/:id/create-access', authorize(['superadmin', 'operador']), createProducerAccess);

export default router;
