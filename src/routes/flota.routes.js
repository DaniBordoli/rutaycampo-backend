import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createFlota,
  getFlotas,
  getFlotaById,
  updateFlota,
  deleteFlota,
  toggleActivaFlota,
  addTransportistaToFlota,
  removeTransportistaFromFlota
} from '../controllers/flota.controller.js';

const router = express.Router();

router.post('/', authenticate, authorize(['superadmin', 'operador']), createFlota);
router.get('/', authenticate, authorize(['superadmin', 'operador']), getFlotas);
router.get('/:id', authenticate, authorize(['superadmin', 'operador']), getFlotaById);
router.put('/:id', authenticate, authorize(['superadmin', 'operador']), updateFlota);
router.delete('/:id', authenticate, authorize(['superadmin']), deleteFlota);
router.patch('/:id/toggle-activa', authenticate, authorize(['superadmin', 'operador']), toggleActivaFlota);
router.post('/:flotaId/transportistas', authenticate, authorize(['superadmin', 'operador']), addTransportistaToFlota);
router.delete('/:flotaId/transportistas/:transportistaId', authenticate, authorize(['superadmin', 'operador']), removeTransportistaFromFlota);

export default router;
