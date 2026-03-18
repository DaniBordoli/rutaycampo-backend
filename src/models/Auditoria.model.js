import mongoose from 'mongoose';

const auditoriaSchema = new mongoose.Schema({
  entidad: {
    type: String,
    required: true,
    enum: ['productor', 'transportista', 'flota', 'camion', 'viaje', 'usuario', 'tarifa']
  },
  entidadId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  accion: {
    type: String,
    required: true,
    enum: ['editar', 'activar', 'desactivar', 'cambiar_contraseña', 'crear', 'eliminar']
  },
  descripcion: {
    type: String,
    required: true
  },
  valorAnterior: {
    type: mongoose.Schema.Types.Mixed
  },
  valorNuevo: {
    type: mongoose.Schema.Types.Mixed
  },
  realizadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  ip: {
    type: String
  }
}, {
  timestamps: true
});

auditoriaSchema.index({ entidad: 1, entidadId: 1 });
auditoriaSchema.index({ realizadoPor: 1 });
auditoriaSchema.index({ createdAt: -1 });

export default mongoose.model('Auditoria', auditoriaSchema);
