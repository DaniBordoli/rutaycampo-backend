import Auditoria from '../models/Auditoria.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';

export const getAuditoria = async (req, res) => {
  try {
    const { entidad, entidadId, limite = 50, pagina = 1 } = req.query;
    const filter = {};
    if (entidad) filter.entidad = entidad;
    if (entidadId) filter.entidadId = entidadId;

    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const [registros, total] = await Promise.all([
      Auditoria.find(filter)
        .populate('realizadoPor', 'nombre email rol')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limite)),
      Auditoria.countDocuments(filter)
    ]);

    res.json({ registros, total, pagina: parseInt(pagina), limite: parseInt(limite) });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getAuditoriaByEntidad = async (req, res) => {
  try {
    const { entidad, id } = req.params;
    const registros = await Auditoria.find({ entidad, entidadId: id })
      .populate('realizadoPor', 'nombre email rol')
      .sort({ createdAt: -1 });

    res.json({ registros });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};
