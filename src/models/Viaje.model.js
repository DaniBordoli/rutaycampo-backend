import mongoose from 'mongoose';

const camionAsignadoSchema = new mongoose.Schema({
  camion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camion'
  },
  transportista: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transportista'
  },
  subEstado: {
    type: String,
    enum: ['pendiente', 'asignado', 'en_origen', 'cargado', 'iniciado', 'en_destino', 'finalizado'],
    default: 'pendiente'
  },
  checkIns: [{
    tipo: {
      type: String,
      enum: ['en_origen', 'cargado', 'iniciado', 'en_destino', 'finalizado'],
      required: true
    },
    fechaHora: { type: Date, default: Date.now },
    ubicacion: { latitud: Number, longitud: Number },
    notas: String
  }]
});

const checkInSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['llegue_a_cargar', 'cargado_saliendo', 'en_camino', 'llegue_a_destino', 'descargado'],
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
    ref: 'Productor'
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
  camionesComunes: {
    type: Number,
    default: 0
  },
  camionesEscalables: {
    type: Number,
    default: 0
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
    enum: ['solicitado', 'buscando_camiones', 'documentacion', 'confirmado', 'en_curso', 'finalizado'],
    default: 'solicitado'
  },
  camionesAsignados: [camionAsignadoSchema],
  distanciaKm: {
    type: Number,
    default: null
  },
  pagoChofer: {
    type: Number,
    default: null
  },
  precios: {
    precioBase: Number,
    tarifaKmTn: Number,
    precioPropuesto: Number,
    precioConfirmado: Number,
    precioFinal: Number
  },
  transportista: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transportista'
  },
  checkIns: [checkInSchema],
  // Legacy — kept for backwards compatibility
  ubicacionActual: {
    latitud: Number,
    longitud: Number,
    ultimaActualizacion: Date
  },
  trackingToken: {
    type: String,
    unique: true,
    sparse: true
  },
  trackingActivo: {
    type: Boolean,
    default: false
  },
  rutaCompleta: [{
    latitud: Number,
    longitud: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    velocidad: Number,
    precision: Number
  }],
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
