import mongoose from 'mongoose';

const choferSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  cuit: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  responsable: {
    type: String,
    required: true,
    trim: true
  },
  telefono: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  activa: {
    type: Boolean,
    default: true
  },
  prioridad: {
    type: String,
    enum: ['alta', 'normal'],
    default: 'normal'
  },
  transportistas: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transportista'
  }],
  notas: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

choferSchema.index({ nombre: 1 });
choferSchema.index({ cuit: 1 });
choferSchema.index({ activa: 1 });
choferSchema.index({ prioridad: 1 });

export default mongoose.model('Chofer', choferSchema);
