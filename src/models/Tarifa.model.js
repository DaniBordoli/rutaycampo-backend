import mongoose from 'mongoose';

const tarifaSchema = new mongoose.Schema({
  origen: {
    ciudad: {
      type: String,
      required: true,
      trim: true
    },
    provincia: {
      type: String,
      required: true,
      trim: true
    }
  },
  destino: {
    ciudad: {
      type: String,
      required: true,
      trim: true
    },
    provincia: {
      type: String,
      required: true,
      trim: true
    }
  },
  precioBase: {
    type: Number,
    default: 0
  },
  precioPorKm: {
    type: Number,
    default: 0
  },
  precioPorTonelada: {
    type: Number,
    default: 0
  },
  activo: {
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

export default mongoose.model('Tarifa', tarifaSchema);
