import Auditoria from '../models/Auditoria.model.js';

export const registrarAuditoria = async ({ entidad, entidadId, accion, descripcion, valorAnterior, valorNuevo, realizadoPor, ip }) => {
  try {
    await Auditoria.create({ entidad, entidadId, accion, descripcion, valorAnterior, valorNuevo, realizadoPor, ip });
  } catch (err) {
    console.error('Error al registrar auditoría:', err.message);
  }
};
