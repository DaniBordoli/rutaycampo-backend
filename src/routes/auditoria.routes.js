import express from 'express';
import { getAuditoria, getAuditoriaByEntidad } from '../controllers/auditoria.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize(['superadmin', 'operador']));

router.get('/', getAuditoria);
router.get('/:entidad/:id', getAuditoriaByEntidad);

export default router;
