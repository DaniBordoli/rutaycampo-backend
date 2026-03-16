import express from 'express';
import {
  createRate,
  getRates,
  getRateById,
  updateRate,
  deleteRate,
  calculatePrice,
  getConfigRangos,
  saveConfigRangos,
  getRoute,
} from '../controllers/rate.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/config-rangos', getConfigRangos);
router.put('/config-rangos', authorize(['superadmin', 'operador']), saveConfigRangos);

router.post('/calculate', calculatePrice);
router.post('/route', getRoute);
router.post('/', authorize(['superadmin', 'operador']), createRate);
router.get('/', getRates);
router.get('/:id', getRateById);
router.put('/:id', authorize(['superadmin', 'operador']), updateRate);
router.delete('/:id', authorize(['superadmin']), deleteRate);

export default router;
