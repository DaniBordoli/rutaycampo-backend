import mongoose from 'mongoose';
import Usuario from './src/models/Usuario.model.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Verificar si ya existe
    const existing = await Usuario.findOne({ email: 'admin@rutaycampo.com' });
    if (existing) {
      console.log('⚠️  Usuario admin ya existe');
      console.log('Email:', existing.email);
      console.log('Rol:', existing.rol);
      process.exit(0);
    }

    // Crear usuario admin
    const admin = await Usuario.create({
      email: 'admin@rutaycampo.com',
      password: 'admin123',
      rol: 'superadmin',
      nombre: 'Administrador',
      telefono: '+5491112345678'
    });

    console.log('✅ Usuario admin creado exitosamente');
    console.log('Email:', admin.email);
    console.log('Password: admin123');
    console.log('Rol:', admin.rol);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createAdmin();
