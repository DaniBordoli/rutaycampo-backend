import Productor from '../models/Productor.model.js';
import Usuario from '../models/Usuario.model.js';
import { generateToken } from '../config/jwt.js';
import crypto from 'crypto';
import emailService from '../services/email.service.js';

export const createProducer = async (req, res) => {
  try {
    const productorData = req.body;
    
    const productor = await Productor.create(productorData);
    
    // Crear usuario con token de invitación
    try {
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');
      
      const usuario = await Usuario.create({
        email: productorData.emailContacto,
        rol: 'productor',
        nombre: productorData.nombreContacto || productorData.razonSocial,
        telefono: productorData.telefonoContacto,
        productorId: productor._id,
        invitationToken: hashedToken,
        invitationExpires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
        activo: false // Usuario inactivo hasta que configure su contraseña
      });
      
      // Enviar email de invitación
      try {
        await emailService.sendProducerInvitationEmail(
          productorData.emailContacto,
          invitationToken,
          productorData.nombreContacto || productorData.razonSocial
        );
        
        res.status(201).json({
          message: 'Productor creado exitosamente. Se ha enviado un email de invitación.',
          producer: productor,
          invitationSent: true,
          // En desarrollo, devolver el token para facilitar testing
          ...(process.env.NODE_ENV === 'development' && {
            invitationToken,
            invitationUrl: `${process.env.FRONTEND_PRODUCTORES_URL || 'http://localhost:5173'}/set-password/${invitationToken}`
          })
        });
      } catch (emailError) {
        // Si falla el envío del email, eliminar usuario y productor
        await Usuario.findByIdAndDelete(usuario._id);
        await Productor.findByIdAndDelete(productor._id);
        throw new Error(`Error al enviar email de invitación: ${emailError.message}`);
      }
    } catch (userError) {
      // Si falla la creación del usuario, eliminar el productor creado
      await Productor.findByIdAndDelete(productor._id);
      throw new Error(`Error al crear usuario: ${userError.message}`);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProducers = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    
    if (isActive !== undefined) {
      filter.activo = isActive === 'true';
    }

    const productores = await Productor.find(filter).sort({ razonSocial: 1 });
    res.json({ producers: productores });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProducerById = async (req, res) => {
  try {
    const productor = await Productor.findById(req.params.id);
    
    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    res.json({ producer: productor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProducer = async (req, res) => {
  try {
    const productor = await Productor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    res.json({
      message: 'Productor actualizado exitosamente',
      producer: productor
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProducer = async (req, res) => {
  try {
    const productor = await Productor.findByIdAndDelete(req.params.id);

    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    res.json({
      message: 'Productor eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProducerAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;

    const productor = await Productor.findById(id);
    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    const existingUser = await Usuario.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const usuario = await Usuario.create({
      email,
      password,
      rol: 'productor',
      nombre: productor.nombreContacto || productor.razonSocial,
      telefono: productor.telefonoContacto,
      productorId: productor._id
    });

    const token = generateToken(usuario._id, usuario.rol);

    res.status(201).json({
      message: 'Acceso creado exitosamente',
      user: usuario.toJSON(),
      token,
      credentials: {
        email,
        password
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
