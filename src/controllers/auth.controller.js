import Usuario from '../models/Usuario.model.js';
import Productor from '../models/Productor.model.js';
import Transportista from '../models/Transportista.model.js';
import { generateToken } from '../config/jwt.js';
import crypto from 'crypto';
import emailService from '../services/email.service.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import { registrarAuditoria } from '../utils/auditoria.js';


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
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días en ms
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ message: 'Tu cuenta aún no está activada. Revisá tu email para configurar tu contraseña.', code: 'ACCOUNT_INACTIVE' });
    }

    const isMatch = await usuario.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = generateToken(usuario._id, usuario.rol);

    res.cookie('token', token, cookieOptions);
    res.json({
      message: 'Login exitoso',
      token,
      user: usuario.toJSON()
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const logout = (req, res) => {
  res.clearCookie('token', cookieOptions);
  res.json({ message: 'Sesión cerrada exitosamente' });
};

export const getProfile = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id)
      .populate('productorId')
      .populate('transportistaId');

    res.json({ user: usuario.toJSON() });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const usuario = await Usuario.findOne({ email });
    
    // Siempre devolver el mismo mensaje para evitar enumeración de emails
    const genericMessage = 'Si existe una cuenta asociada a ese correo electrónico, te enviaremos un enlace para recuperar tu contraseña';
    
    if (!usuario) {
      return res.json({ message: genericMessage });
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
        message: genericMessage,
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
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
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
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { nombre, telefono, currentPassword, newPassword } = req.body;

    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const valorAnterior = {};
    const valorNuevo = {};

    if (nombre && nombre.trim() !== usuario.nombre) {
      valorAnterior.nombre = usuario.nombre;
      valorNuevo.nombre = nombre.trim();
      usuario.nombre = nombre.trim();
    }
    if (telefono !== undefined && telefono.trim() !== usuario.telefono) {
      valorAnterior.telefono = usuario.telefono;
      valorNuevo.telefono = telefono.trim();
      usuario.telefono = telefono.trim();
    }

    let cambioPassword = false;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Debes ingresar tu contraseña actual para cambiarla' });
      }
      const isMatch = await usuario.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
      }
      usuario.password = newPassword;
      cambioPassword = true;
    }

    await usuario.save();

    // Registrar auditoría si hubo cambios de datos de perfil
    if (Object.keys(valorNuevo).length > 0 && usuario.productorId) {
      await registrarAuditoria({
        entidad: 'productor',
        entidadId: usuario.productorId,
        accion: 'editar',
        descripcion: `Productor editó su perfil: ${usuario.nombre}`,
        valorAnterior,
        valorNuevo,
        realizadoPor: usuario._id,
        ip: req.ip
      });
    }

    // Registrar auditoría si cambió contraseña
    if (cambioPassword && usuario.productorId) {
      await registrarAuditoria({
        entidad: 'productor',
        entidadId: usuario.productorId,
        accion: 'cambiar_contraseña',
        descripcion: `Productor cambió su contraseña`,
        valorAnterior: {},
        valorNuevo: {},
        realizadoPor: usuario._id,
        ip: req.ip
      });
    }

    const updatedUser = usuario.toJSON();
    res.json({ message: 'Perfil actualizado exitosamente', user: updatedUser });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const validateInvitationToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token requerido' });
    }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const usuario = await Usuario.findOne({
      invitationToken: hashedToken,
      invitationExpires: { $gt: Date.now() }
    });
    if (!usuario) {
      return res.status(400).json({ valid: false, message: 'El enlace de invitación es inválido o ya expiró. Solicitá un nuevo enlace al administrador.' });
    }
    res.json({ valid: true, email: usuario.email });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ valid: false, message });
  }
};

export const setPasswordFromInvitation = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token y contraseña son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const usuario = await Usuario.findOne({
      invitationToken: hashedToken,
      invitationExpires: { $gt: Date.now() }
    });

    if (!usuario) {
      return res.status(400).json({ message: 'Token de invitación inválido o expirado' });
    }

    // Configurar contraseña y activar usuario
    usuario.password = password;
    usuario.invitationToken = undefined;
    usuario.invitationExpires = undefined;
    usuario.activo = true;

    await usuario.save();

    if (usuario.productorId) {
      await registrarAuditoria({
        entidad: 'productor',
        entidadId: usuario.productorId,
        accion: 'activar',
        descripcion: `Productor activó su cuenta y configuró su contraseña (${usuario.email})`,
        valorAnterior: { activo: false },
        valorNuevo: { activo: true },
        realizadoPor: usuario._id,
        ip: req.ip
      });
    }

    // Generar token JWT para login automático
    const authToken = generateToken(usuario._id, usuario.rol);

    res.json({
      message: 'Contraseña configurada exitosamente',
      token: authToken,
      user: usuario.toJSON()
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

