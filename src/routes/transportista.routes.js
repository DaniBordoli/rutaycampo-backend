import express from 'express';
import {
  createTransportista,
  getTransportistas,
  getTransportistaById,
  updateTransportista,
  deleteTransportista,
  toggleAvailability,
  deactivateTransportista,
  activateTransportista
} from '../controllers/transportista.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', authorize(['superadmin', 'operador']), createTransportista);
router.get('/', getTransportistas);
router.get('/:id', getTransportistaById);
router.put('/:id', authorize(['superadmin', 'operador']), updateTransportista);
router.delete('/:id', authorize(['superadmin']), deleteTransportista);
router.patch('/:id/toggle-availability', authorize(['superadmin', 'operador']), toggleAvailability);
router.patch('/:id/deactivate', authorize(['superadmin', 'operador']), deactivateTransportista);
router.patch('/:id/activate', authorize(['superadmin', 'operador']), activateTransportista);

export default router;
