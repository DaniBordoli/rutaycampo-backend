import mongoose from 'mongoose';

const transportistaSchema = new mongoose.Schema({
  razonSocial: {
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
  nombreConductor: {
    type: String,
    required: true,
    trim: true
  },
  licenciaConductor: {
    type: String,
    required: true,
    trim: true
  },
  patente: {
    type: String,
    required: true,
    trim: true
  },
  capacidad: {
    type: Number,
    required: true
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
  activo: {
    type: Boolean,
    default: true
  },
  disponible: {
    type: Boolean,
    default: true
  },
  notas: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Transportista', transportistaSchema);
