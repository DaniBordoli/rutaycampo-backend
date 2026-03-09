import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// ── Schemas inline (no importar modelos para evitar dependencias) ─────────────

const productorSchema = new mongoose.Schema({
  razonSocial: { type: String, required: true, trim: true },
  cuit: { type: String, required: true, unique: true, trim: true },
  direccion: { calle: String, ciudad: String, provincia: String, codigoPostal: String },
  nombreContacto: { type: String, required: true, trim: true },
  apellidoContacto: { type: String, required: true, trim: true },
  emailContacto: { type: String, required: true, lowercase: true, trim: true },
  telefonoContacto: { type: String, required: true, trim: true },
  numeroWhatsapp: { type: String, trim: true },
  tipoProduccion: { type: String, enum: ['Cereales', 'Oleaginosas', 'Ganadería', 'Mixto', 'Otro'], required: true },
  activo: { type: Boolean, default: true },
  notas: { type: String, trim: true },
}, { timestamps: true });

const usuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6 },
  rol: { type: String, enum: ['productor', 'superadmin', 'operador', 'transportista'], required: true },
  nombre: { type: String, required: true, trim: true },
  telefono: { type: String, trim: true },
  activo: { type: Boolean, default: true },
  productorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Productor' },
  invitationToken: String,
  invitationExpires: Date,
}, { timestamps: true });

usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const Productor = mongoose.models.Productor || mongoose.model('Productor', productorSchema);
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);

// ── Datos del productor de prueba ─────────────────────────────────────────────

const PRODUCTOR_DATA = {
  razonSocial: 'Agropecuaria Los Aromos S.A.',
  cuit: '30-71234567-8',
  direccion: {
    calle: 'Ruta Nacional 188 Km 412',
    ciudad: 'General Villegas',
    provincia: 'Buenos Aires',
    codigoPostal: '6230',
  },
  nombreContacto: 'Carlos',
  apellidoContacto: 'Mendoza',
  emailContacto: 'carlos.mendoza@losaromos.com.ar',
  telefonoContacto: '+54 9 2350 45-6789',
  numeroWhatsapp: '+5492350456789',
  tipoProduccion: 'Cereales',
  activo: true,
  notas: 'Productor de prueba creado por seed script',
};

const USUARIO_PASSWORD = 'prueba123';

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🔌 Conectando a MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conectado\n');

  // Limpiar si ya existe (para poder re-ejecutar)
  const existingProductor = await Productor.findOne({ cuit: PRODUCTOR_DATA.cuit });
  if (existingProductor) {
    console.log(`⚠️  Ya existe un productor con CUIT ${PRODUCTOR_DATA.cuit}. Eliminando para recrear...`);
    await Usuario.deleteOne({ productorId: existingProductor._id });
    await Productor.deleteOne({ _id: existingProductor._id });
  }

  const existingUsuario = await Usuario.findOne({ email: PRODUCTOR_DATA.emailContacto });
  if (existingUsuario) {
    console.log(`⚠️  Ya existe un usuario con email ${PRODUCTOR_DATA.emailContacto}. Eliminando...`);
    await Usuario.deleteOne({ _id: existingUsuario._id });
  }

  // Crear productor
  console.log('📦 Creando productor...');
  const productor = await Productor.create(PRODUCTOR_DATA);
  console.log(`✅ Productor creado: ${productor.razonSocial} (ID: ${productor._id})`);

  // Crear usuario asociado con contraseña directa (activo)
  console.log('👤 Creando usuario de acceso...');
  const usuario = new Usuario({
    email: PRODUCTOR_DATA.emailContacto,
    password: USUARIO_PASSWORD,
    rol: 'productor',
    nombre: `${PRODUCTOR_DATA.nombreContacto} ${PRODUCTOR_DATA.apellidoContacto}`,
    telefono: PRODUCTOR_DATA.telefonoContacto,
    productorId: productor._id,
    activo: true,
  });
  await usuario.save();
  console.log(`✅ Usuario creado: ${usuario.email} (ID: ${usuario._id})`);

  console.log('\n─────────────────────────────────────────');
  console.log('🎉 Productor de prueba creado exitosamente');
  console.log('─────────────────────────────────────────');
  console.log(`  Razón Social : ${PRODUCTOR_DATA.razonSocial}`);
  console.log(`  CUIT         : ${PRODUCTOR_DATA.cuit}`);
  console.log(`  Email login  : ${PRODUCTOR_DATA.emailContacto}`);
  console.log(`  Contraseña   : ${USUARIO_PASSWORD}`);
  console.log(`  Portal URL   : http://localhost:5173`);
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB');
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
