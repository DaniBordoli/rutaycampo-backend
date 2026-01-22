import Usuario from '../models/Usuario.model.js';
import Productor from '../models/Productor.model.js';
import Transportista from '../models/Transportista.model.js';
import { generateToken } from '../config/jwt.js';
import crypto from 'crypto';
import emailService from '../services/email.service.js';

export const register = async (req, res) => {
  try {
    const { email, password, role, name, phone, producerData, transportistaData } = req.body;

    const existingUser = await Usuario.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    let productorId = null;
    let transportistaId = null;

    if (role === 'productor' && producerData) {
      const productor = await Productor.create(producerData);
      productorId = productor._id;
    }

    if (role === 'transportista' && transportistaData) {
      const transportista = await Transportista.create(transportistaData);
      transportistaId = transportista._id;
    }

    const usuario = await Usuario.create({
      email,
      password,
      rol: role,
      nombre: name,
      telefono: phone,
      productorId,
      transportistaId
    });

    const token = generateToken(usuario._id, usuario.rol);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: usuario.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ email });
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isMatch = await usuario.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = generateToken(usuario._id, usuario.rol);

    res.json({
      message: 'Login exitoso',
      token,
      user: usuario.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id)
      .populate('productorId')
      .populate('transportistaId');

    res.json({ user: usuario.toJSON() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ message: 'No existe un usuario con ese email' });
    }

    // Generar token de recuperación
    const resetToken = crypto.randomBytes(32).toString('hex');
    usuario.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    usuario.resetPasswordExpires = Date.now() + 3600000; // 1 hora

    await usuario.save();

    // Enviar email con el token
    try {
      await emailService.sendPasswordResetEmail(email, resetToken, usuario.nombre);
      
      res.json({
        message: 'Se ha enviado un email con las instrucciones para recuperar tu contraseña',
        // En desarrollo, también devolver el token para facilitar testing
        ...(process.env.NODE_ENV === 'development' && {
          resetToken,
          resetUrl: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
        })
      });
    } catch (emailError) {
      // Si falla el envío del email, limpiar el token
      usuario.resetPasswordToken = undefined;
      usuario.resetPasswordExpires = undefined;
      await usuario.save();
      
      throw new Error('Error al enviar el email de recuperación. Por favor, intenta nuevamente.');
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const usuario = await Usuario.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!usuario) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    // Actualizar contraseña
    usuario.password = newPassword;
    usuario.resetPasswordToken = undefined;
    usuario.resetPasswordExpires = undefined;

    await usuario.save();

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
