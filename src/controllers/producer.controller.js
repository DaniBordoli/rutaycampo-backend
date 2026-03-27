import Productor from '../models/Productor.model.js';
import Usuario from '../models/Usuario.model.js';
import Chofer from '../models/Chofer.model.js';
import Transportista from '../models/Transportista.model.js';
import { generateToken } from '../config/jwt.js';
import crypto from 'crypto';
import emailService from '../services/email.service.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import { registrarAuditoria } from '../utils/auditoria.js';

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
    
    // Verificar si el email ya existe en cualquier entidad
    if (productorData.emailContacto) {
      const email = productorData.emailContacto.toLowerCase().trim();
      const [existingUser, existingChofer, existingTransportista] = await Promise.all([
        Usuario.findOne({ email }),
        Chofer.findOne({ email }),
        Transportista.findOne({ email }),
      ]);
      if (existingUser || existingChofer || existingTransportista) {
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
    const contactName = productorData.nombreContacto || productorData.razonSocial;

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

    if (invitationSent) {
      await registrarAuditoria({
        entidad: 'productor',
        entidadId: productor._id,
        accion: 'crear',
        descripcion: `Productor creado y email de invitación enviado a ${productorData.emailContacto}`,
        valorAnterior: {},
        valorNuevo: { razonSocial: productor.razonSocial, email: productorData.emailContacto },
        realizadoPor: req.user?._id,
        ip: req.ip
      });
    }

    res.status(201).json({
      message: invitationSent
        ? 'Productor creado exitosamente. Se ha enviado un email de invitación.'
        : 'Productor creado exitosamente.',
      producer: productor,
      invitationSent,
      ...(['development', 'staging'].includes(process.env.NODE_ENV) && {
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
    const productores = await Productor.find().sort({ razonSocial: 1 });

    const usuarios = await Usuario.find(
      { productorId: { $in: productores.map(p => p._id) } },
      { productorId: 1, activo: 1 }
    );
    const activoMap = {};
    usuarios.forEach(u => { activoMap[u.productorId.toString()] = u.activo; });

    const enriched = productores.map(p => ({
      ...p.toObject(),
      activo: activoMap[p._id.toString()] ?? false
    }));

    // Filtro opcional por estado
    const { isActive } = req.query;
    const filtered = isActive !== undefined
      ? enriched.filter(p => p.activo === (isActive === 'true'))
      : enriched;

    res.json({ producers: filtered });
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

    const usuario = await Usuario.findOne({ productorId: productor._id }, { activo: 1 });
    const enriched = { ...productor.toObject(), activo: usuario?.activo ?? false };

    res.json({ producer: enriched });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateProducer = async (req, res) => {
  try {
    const anterior = await Productor.findById(req.params.id);

    if (!anterior) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    const productor = await Productor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // Sincronizar email en Usuario si cambió emailContacto
    if (req.body.emailContacto && req.body.emailContacto !== anterior.emailContacto) {
      await Usuario.findOneAndUpdate(
        { productorId: productor._id },
        { email: req.body.emailContacto.toLowerCase().trim() }
      );
    }

    const camposAuditables = ['razonSocial', 'cuit', 'nombreContacto', 'apellidoContacto', 'emailContacto', 'telefonoContacto', 'tipoProduccion', 'direccion'];
    const valorAnterior = {};
    const valorNuevo = {};

    camposAuditables.forEach(campo => {
      const prev = JSON.stringify(anterior[campo]);
      const next = JSON.stringify(productor[campo]);
      if (prev !== next) {
        valorAnterior[campo] = anterior[campo];
        valorNuevo[campo] = productor[campo];
      }
    });

    if (Object.keys(valorNuevo).length > 0) {
      await registrarAuditoria({
        entidad: 'productor',
        entidadId: productor._id,
        accion: 'editar',
        descripcion: `Productor editado: ${productor.razonSocial}`,
        valorAnterior,
        valorNuevo,
        realizadoPor: req.user._id,
        ip: req.ip
      });
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

    const usuario = await Usuario.findOne({ productorId: productor._id });
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario vinculado no encontrado' });
    }

    const estadoAnterior = usuario.activo;
    usuario.activo = !usuario.activo;
    await usuario.save();

    await registrarAuditoria({
      entidad: 'productor',
      entidadId: productor._id,
      accion: usuario.activo ? 'activar' : 'desactivar',
      descripcion: `Productor ${usuario.activo ? 'activado' : 'desactivado'}: ${productor.razonSocial}`,
      valorAnterior: { activo: estadoAnterior },
      valorNuevo: { activo: usuario.activo },
      realizadoPor: req.user._id,
      ip: req.ip
    });

    res.json({
      message: `Productor ${usuario.activo ? 'activado' : 'desactivado'} exitosamente`,
      producer: productor,
      isActive: usuario.activo
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
    const { email } = req.body;

    const productor = await Productor.findById(id);
    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    const existingUser = await Usuario.findOne({ productorId: id });
    if (existingUser) {
      // Reenviar invitación regenerando token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');
      existingUser.invitationToken = hashedToken;
      existingUser.invitationExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
      existingUser.activo = false;
      await existingUser.save();

      const contactName = existingUser.nombre;
      let invitationSent = false;
      try {
        await emailService.sendProducerInvitationEmail(existingUser.email, invitationToken, contactName);
        invitationSent = true;
      } catch (emailError) {
        console.error('Error al reenviar email de invitación:', emailError.message);
      }

      await registrarAuditoria({
        entidad: 'productor',
        entidadId: productor._id,
        accion: 'crear',
        descripcion: `Invitación reenviada a ${existingUser.email}`,
        valorAnterior: {},
        valorNuevo: { email: existingUser.email, invitationSent },
        realizadoPor: req.user?._id,
        ip: req.ip
      });

      return res.json({
        message: invitationSent
          ? 'Email de invitación reenviado exitosamente.'
          : 'Token renovado pero no se pudo enviar el email.',
        invitationSent,
        ...(['development', 'staging'].includes(process.env.NODE_ENV) && {
          invitationToken,
          invitationUrl: `${process.env.FRONTEND_PRODUCTORES_URL || 'http://localhost:5173'}/set-password/${invitationToken}`
        })
      });
    }

    const emailToUse = email || productor.emailContacto;
    if (!emailToUse) {
      return res.status(400).json({ message: 'Se requiere un email para crear el acceso' });
    }

    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');
    const contactName = [productor.nombreContacto, productor.apellidoContacto].filter(Boolean).join(' ') || productor.razonSocial;

    await Usuario.create({
      email: emailToUse,
      rol: 'productor',
      nombre: contactName,
      telefono: productor.telefonoContacto,
      productorId: productor._id,
      invitationToken: hashedToken,
      invitationExpires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      activo: false
    });

    let invitationSent = false;
    try {
      await emailService.sendProducerInvitationEmail(emailToUse, invitationToken, contactName);
      invitationSent = true;
    } catch (emailError) {
      console.error('Error al enviar email de invitación:', emailError.message);
    }

    await registrarAuditoria({
      entidad: 'productor',
      entidadId: productor._id,
      accion: 'crear',
      descripcion: `Acceso creado y email de invitación enviado a ${emailToUse}`,
      valorAnterior: {},
      valorNuevo: { email: emailToUse, invitationSent },
      realizadoPor: req.user?._id,
      ip: req.ip
    });

    res.status(201).json({
      message: invitationSent
        ? 'Acceso creado exitosamente. Se ha enviado un email de invitación.'
        : 'Acceso creado exitosamente.',
      invitationSent,
      ...(['development', 'staging'].includes(process.env.NODE_ENV) && {
        invitationToken,
        invitationUrl: `${process.env.FRONTEND_PRODUCTORES_URL || 'http://localhost:5173'}/set-password/${invitationToken}`
      })
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};
