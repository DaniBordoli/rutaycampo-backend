import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createChofer,
  getChoferes,
  getChoferById,
  updateChofer,
  deleteChofer,
  toggleActivaChofer,
  addTransportistaToChofer,
  removeTransportistaFromChofer,
  uploadDocumentosHandler,
  deleteDocumentoChofer
} from '../controllers/chofer.controller.js';

const router = express.Router();

router.post('/', authenticate, authorize(['superadmin', 'operador']), createChofer);
router.get('/', authenticate, authorize(['superadmin', 'operador']), getChoferes);
router.get('/:id', authenticate, authorize(['superadmin', 'operador']), getChoferById);
router.put('/:id', authenticate, authorize(['superadmin', 'operador']), updateChofer);
router.delete('/:id', authenticate, authorize(['superadmin']), deleteChofer);
router.patch('/:id/toggle-activa', authenticate, authorize(['superadmin', 'operador']), toggleActivaChofer);
router.post('/:choferId/transportistas', authenticate, authorize(['superadmin', 'operador']), addTransportistaToChofer);
router.delete('/:choferId/transportistas/:transportistaId', authenticate, authorize(['superadmin', 'operador']), removeTransportistaFromChofer);
router.post('/:id/documentos', authenticate, authorize(['superadmin', 'operador']), uploadDocumentosHandler);
router.delete('/:id/documentos/:docId', authenticate, authorize(['superadmin', 'operador']), deleteDocumentoChofer);

export default router;
