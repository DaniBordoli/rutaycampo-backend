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
  licenciaVencimiento: {
    type: Date
  },
  documentos: [{
    name: { type: String },
    url: { type: String },
    size: { type: Number },
    storagePath: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  notas: {
    type: String,
    trim: true
  },
  puntuacion: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  }
}, {
  timestamps: true
});

choferSchema.index({ nombre: 1 });
choferSchema.index({ activa: 1 });
choferSchema.index({ prioridad: 1 });

export default mongoose.model('Chofer', choferSchema);
