import express from 'express';
import {
  createCamion,
  getCamiones,
  getCamionById,
  updateCamion,
  deleteCamion,
  toggleDisponibilidad,
  getCamionesByTransportista,
  assignCamionToTransportista
} from '../controllers/camion.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', authorize(['superadmin', 'operador']), createCamion);
router.get('/', getCamiones);
router.get('/:id', getCamionById);
router.put('/:id', authorize(['superadmin', 'operador']), updateCamion);
router.delete('/:id', authorize(['superadmin']), deleteCamion);
router.patch('/:id/toggle-disponibilidad', authorize(['superadmin', 'operador']), toggleDisponibilidad);
router.get('/transportista/:transportistaId', getCamionesByTransportista);
router.patch('/:camionId/assign', authorize(['superadmin', 'operador']), assignCamionToTransportista);

export default router;
