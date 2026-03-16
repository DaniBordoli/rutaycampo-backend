import mongoose from 'mongoose';

const rangoKmSchema = new mongoose.Schema({
  startKm: { type: Number, required: true, min: 0 },
  endKm:   { type: Number, required: true, min: 0 },
  precioPorTonelada: { type: Number, required: true, min: 0 },
}, { _id: false });

const tarifaSchema = new mongoose.Schema({
  esConfiguracionGlobal: {
    type: Boolean,
    default: false,
  },
  rangosKm: {
    type: [rangoKmSchema],
    default: [],
  },
  origen: {
    ciudad: { type: String, trim: true },
    provincia: { type: String, trim: true },
  },
  destino: {
    ciudad: { type: String, trim: true },
    provincia: { type: String, trim: true },
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
