import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['llegue_a_cargar', 'cargado', 'sali', 'descargue'],
    required: true
  },
  fechaHora: {
    type: Date,
    default: Date.now
  },
  ubicacion: {
    latitud: Number,
    longitud: Number
  },
  notas: String
});

const viajeSchema = new mongoose.Schema({
  numeroViaje: {
    type: String,
    unique: true,
    required: true
  },
  productor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Productor',
    required: true
  },
  origen: {
    direccion: { type: String, required: true },
    ciudad: { type: String, required: true },
    provincia: { type: String, required: true },
    coordenadas: {
      latitud: Number,
      longitud: Number
    }
  },
  destino: {
    direccion: { type: String, required: true },
    ciudad: { type: String, required: true },
    provincia: { type: String, required: true },
    coordenadas: {
      latitud: Number,
      longitud: Number
    }
  },
  tipoDestino: {
    type: String,
    enum: ['puerto', 'acopio'],
    required: true
  },
  fechaProgramada: {
    type: Date,
    required: true
  },
  ventanaFecha: {
    inicio: Date,
    fin: Date
  },
  tipoCarga: {
    type: String,
    default: 'grano'
  },
  peso: {
    type: Number,
    required: true
  },
  camionesRecomendados: {
    type: Number,
    required: true
  },
  camionesSolicitados: {
    type: Number,
    required: true
  },
  cartaDePorte: {
    nombreArchivo: String,
    ruta: String,
    fechaSubida: Date
  },
  cupo: {
    nombreArchivo: String,
    ruta: String,
    fechaSubida: Date
  },
  notas: String,
  estado: {
    type: String,
    enum: ['solicitado', 'cotizando', 'confirmado', 'en_asignacion', 'en_curso', 'finalizado'],
    default: 'solicitado'
  },
  precios: {
    precioBase: Number,
    precioPropuesto: Number,
    precioConfirmado: Number,
    precioFinal: Number
  },
  transportista: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transportista'
  },
  checkIns: [checkInSchema],
  ubicacionActual: {
    latitud: Number,
    longitud: Number,
    ultimaActualizacion: Date
  },
  distancia: Number,
  duracionEstimada: Number,
  historialEstados: [{
    estado: String,
    cambiadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    cambiadoEn: {
      type: Date,
      default: Date.now
    },
    notas: String
  }]
}, {
  timestamps: true
});

viajeSchema.pre('save', async function(next) {
  if (this.isNew && !this.numeroViaje) {
    const count = await mongoose.model('Viaje').countDocuments();
    this.numeroViaje = `VJ-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

export default mongoose.model('Viaje', viajeSchema);
