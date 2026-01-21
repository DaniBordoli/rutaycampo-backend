import mongoose from 'mongoose';

const productorSchema = new mongoose.Schema({
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
  direccion: {
    calle: String,
    ciudad: String,
    provincia: String,
    codigoPostal: String
  },
  nombreContacto: {
    type: String,
    required: true,
    trim: true
  },
  emailContacto: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  telefonoContacto: {
    type: String,
    required: true,
    trim: true
  },
  numeroWhatsapp: {
    type: String,
    trim: true
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

export default mongoose.model('Productor', productorSchema);
