import Productor from '../models/Productor.model.js';
import Usuario from '../models/Usuario.model.js';
import { generateToken } from '../config/jwt.js';
import crypto from 'crypto';
import emailService from '../services/email.service.js';
import { sanitizeError } from '../utils/sanitizeError.js';

export const createProducer = async (req, res) => {
  try {
    const productorData = req.body;
    
    // Verificar si el CUIT ya existe
    if (productorData.cuit) {
      const existingProductor = await Productor.findOne({ cuit: productorData.cuit });
      if (existingProductor) {
        return res.status(409).json({ 
          message: `El CUIT ${productorData.cuit} ya está registrado en el sistema`,
          field: 'cuit'
        });
      }
    }
    
    // Verificar si el email ya existe
    if (productorData.emailContacto) {
      const existingUser = await Usuario.findOne({ email: productorData.emailContacto });
      if (existingUser) {
        return res.status(409).json({ 
          message: `El email ${productorData.emailContacto} ya está registrado en el sistema`,
          field: 'email'
        });
      }
    }
    
    const productor = await Productor.create(productorData);
    
    // Crear usuario con token de invitación
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');
    const contactName = [productorData.nombreContacto, productorData.apellidoContacto].filter(Boolean).join(' ') || productorData.razonSocial;

    let invitationSent = false;
    try {
      await Usuario.create({
        email: productorData.emailContacto,
        rol: 'productor',
        nombre: contactName,
        telefono: productorData.telefonoContacto,
        productorId: productor._id,
        invitationToken: hashedToken,
        invitationExpires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        activo: false
      });

      try {
        await emailService.sendProducerInvitationEmail(
          productorData.emailContacto,
          invitationToken,
          contactName
        );
        invitationSent = true;
      } catch (emailError) {
        console.error('Error al enviar email de invitación (productor creado igual):', emailError.message);
      }
    } catch (userError) {
      if (userError.code === 11000) {
        await Productor.findByIdAndDelete(productor._id);
        return res.status(409).json({
          message: 'El email ingresado ya está registrado en el sistema.',
          field: 'email'
        });
      }
      console.error('Error al crear usuario para productor:', userError.message);
    }

    res.status(201).json({
      message: invitationSent
        ? 'Productor creado exitosamente. Se ha enviado un email de invitación.'
        : 'Productor creado exitosamente.',
      producer: productor,
      invitationSent,
      ...(process.env.NODE_ENV === 'development' && {
        invitationToken,
        invitationUrl: `${process.env.FRONTEND_PRODUCTORES_URL || 'http://localhost:5173'}/set-password/${invitationToken}`
      })
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
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
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
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
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
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
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const toggleProducerActive = async (req, res) => {
  try {
    const productor = await Productor.findById(req.params.id);

    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    productor.activo = !productor.activo;
    await productor.save();

    res.json({
      message: `Productor ${productor.activo ? 'activado' : 'desactivado'} exitosamente`,
      producer: productor
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
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
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
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
      nombre: [productor.nombreContacto, productor.apellidoContacto].filter(Boolean).join(' ') || productor.razonSocial,
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
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};
