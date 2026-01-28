import mongoose from 'mongoose';

const camionSchema = new mongoose.Schema({
  patente: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  marca: {
    type: String,
    trim: true
  },
  modelo: {
    type: String,
    trim: true
  },
  año: {
    type: Number
  },
  tipo: {
    type: String,
    enum: ['chasis', 'acoplado', 'batea', 'tolva', 'tanque', 'otro'],
    default: 'chasis'
  },
  capacidad: {
    type: Number,
    required: true
  },
  unidadCapacidad: {
    type: String,
    enum: ['toneladas', 'metros_cubicos', 'litros'],
    default: 'toneladas'
  },
  transportista: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transportista',
    required: true
  },
  seguro: {
    compania: {
      type: String,
      trim: true
    },
    numeroPoliza: {
      type: String,
      trim: true
    },
    vencimiento: {
      type: Date
    }
  },
  vtv: {
    fecha: {
      type: Date
    },
    vencimiento: {
      type: Date
    }
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

camionSchema.index({ transportista: 1 });
camionSchema.index({ patente: 1 });
camionSchema.index({ disponible: 1, activo: 1 });

export default mongoose.model('Camion', camionSchema);
