import Chofer from '../models/Chofer.model.js';
import Transportista from '../models/Transportista.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { uploadDocumentosChofer, cloudinary } from '../services/cloudinary.service.js';


export const createChofer = async (req, res) => {
  try {
    const { nombre, cuit, responsable, telefono, email, prioridad, notas, licenciaVencimiento, documentos } = req.body;

    const cuitExists = await Chofer.findOne({ cuit: cuit.trim() });
    if (cuitExists) {
      return res.status(400).json({ message: 'Ya existe un chofer con ese CUIT' });
    }

    const chofer = new Chofer({
      nombre,
      cuit: cuit.trim(),
      responsable,
      telefono,
      email,
      prioridad,
      notas,
      licenciaVencimiento,
      documentos
    });

    await chofer.save();

    res.status(201).json({
      message: 'Chofer creado exitosamente',
      chofer
    });
  } catch (error) {
    console.error('Error al crear chofer:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getChoferes = async (req, res) => {
  try {
    const { activa, prioridad, search, transportistaId } = req.query;
    const filter = {};

    if (activa !== undefined) {
      filter.activa = activa === 'true';
    }

    if (prioridad) {
      filter.prioridad = prioridad;
    }

    if (transportistaId) {
      filter.transportistas = transportistaId;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { nombre: searchRegex },
        { cuit: searchRegex },
        { responsable: searchRegex },
        { telefono: searchRegex }
      ];
    }

    const choferes = await Chofer.find(filter)
      .populate('transportistas', 'razonSocial nombre cuit')
      .sort({ prioridad: -1, nombre: 1 });

    res.json(choferes);
  } catch (error) {
    console.error('Error al obtener choferes:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getChoferById = async (req, res) => {
  try {
    const chofer = await Chofer.findById(req.params.id)
      .populate('transportistas', 'razonSocial nombre cuit numeroWhatsapp email');

    if (!chofer) {
      return res.status(404).json({ message: 'Chofer no encontrado' });
    }

    res.json(chofer);
  } catch (error) {
    console.error('Error al obtener chofer:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateChofer = async (req, res) => {
  try {
    const { nombre, cuit, responsable, telefono, email, prioridad, activa, notas, licenciaVencimiento, documentos, transportistas } = req.body;

    const chofer = await Chofer.findById(req.params.id);
    if (!chofer) {
      return res.status(404).json({ message: 'Chofer no encontrado' });
    }

    const anterior = chofer.toObject();

    if (cuit && cuit.trim() !== chofer.cuit) {
      const cuitExists = await Chofer.findOne({
        cuit: cuit.trim(),
        _id: { $ne: req.params.id }
      });
      if (cuitExists) {
        return res.status(400).json({ message: 'Ya existe un chofer con ese CUIT' });
      }
      chofer.cuit = cuit.trim();
    }

    if (nombre !== undefined) chofer.nombre = nombre;
    if (responsable !== undefined) chofer.responsable = responsable;
    if (telefono !== undefined) chofer.telefono = telefono;
    if (email !== undefined) chofer.email = email;
    if (prioridad !== undefined) chofer.prioridad = prioridad;
    if (activa !== undefined) chofer.activa = activa;
    if (notas !== undefined) chofer.notas = notas;
    if (licenciaVencimiento !== undefined) chofer.licenciaVencimiento = licenciaVencimiento;
    if (documentos !== undefined) chofer.documentos = documentos;
    if (transportistas !== undefined) chofer.transportistas = transportistas;

    await chofer.save();
    await chofer.populate('transportistas', 'razonSocial nombre cuit');

    const camposAuditables = ['nombre', 'cuit', 'responsable', 'telefono', 'email', 'prioridad', 'activa', 'notas'];
    const valorAnterior = {};
    const valorNuevo = {};
    camposAuditables.forEach(campo => {
      if (JSON.stringify(anterior[campo]) !== JSON.stringify(chofer[campo])) {
        valorAnterior[campo] = anterior[campo];
        valorNuevo[campo] = chofer[campo];
      }
    });

    if (Object.keys(valorNuevo).length > 0) {
      await registrarAuditoria({
        entidad: 'chofer',
        entidadId: chofer._id,
        accion: 'editar',
        descripcion: `Chofer editado: ${chofer.nombre}`,
        valorAnterior,
        valorNuevo,
        realizadoPor: req.user._id,
        ip: req.ip
      });
    }

    res.json({
      message: 'Chofer actualizado exitosamente',
      chofer
    });
  } catch (error) {
    console.error('Error al actualizar chofer:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const deleteChofer = async (req, res) => {
  try {
    const chofer = await Chofer.findByIdAndDelete(req.params.id);
    if (!chofer) {
      return res.status(404).json({ message: 'Chofer no encontrado' });
    }

    res.json({ message: 'Chofer eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar chofer:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const toggleActivaChofer = async (req, res) => {
  try {
    const chofer = await Chofer.findById(req.params.id);
    if (!chofer) {
      return res.status(404).json({ message: 'Chofer no encontrado' });
    }

    const activaAnterior = chofer.activa;
    chofer.activa = !chofer.activa;
    await chofer.save();

    await registrarAuditoria({
      entidad: 'chofer',
      entidadId: chofer._id,
      accion: chofer.activa ? 'activar' : 'desactivar',
      descripcion: `Chofer ${chofer.activa ? 'activado' : 'desactivado'}: ${chofer.nombre}`,
      valorAnterior: { activa: activaAnterior },
      valorNuevo: { activa: chofer.activa },
      realizadoPor: req.user._id,
      ip: req.ip
    });

    res.json({
      message: `Chofer ${chofer.activa ? 'activado' : 'desactivado'} exitosamente`,
      chofer
    });
  } catch (error) {
    console.error('Error al cambiar estado de chofer:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const addTransportistaToChofer = async (req, res) => {
  try {
    const { choferId } = req.params;
    const { transportistaId } = req.body;

    const chofer = await Chofer.findById(choferId);
    if (!chofer) {
      return res.status(404).json({ message: 'Chofer no encontrado' });
    }

    const transportista = await Transportista.findById(transportistaId);
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    if (chofer.transportistas.includes(transportistaId)) {
      return res.status(400).json({ message: 'El transportista ya está asociado a este chofer' });
    }

    chofer.transportistas.push(transportistaId);
    await chofer.save();
    await chofer.populate('transportistas', 'razonSocial nombre cuit');

    res.json({
      message: 'Transportista agregado al chofer exitosamente',
      chofer
    });
  } catch (error) {
    console.error('Error al agregar transportista a chofer:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const removeTransportistaFromChofer = async (req, res) => {
  try {
    const { choferId, transportistaId } = req.params;

    const chofer = await Chofer.findById(choferId);
    if (!chofer) {
      return res.status(404).json({ message: 'Chofer no encontrado' });
    }

    chofer.transportistas = chofer.transportistas.filter(
      t => t.toString() !== transportistaId
    );

    await chofer.save();
    await chofer.populate('transportistas', 'razonSocial nombre cuit');

    res.json({
      message: 'Transportista removido del chofer exitosamente',
      chofer
    });
  } catch (error) {
    console.error('Error al remover transportista de chofer:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const uploadDocumentosHandler = (req, res) => {
  uploadDocumentosChofer(req, res, async (err) => {
    if (err) {
      console.error('Error en uploadDocumentosChofer:', err);
      return res.status(400).json({ message: err.message || 'Error al subir archivos' });
    }

    try {
      const chofer = await Chofer.findById(req.params.id);
      if (!chofer) return res.status(404).json({ message: 'Chofer no encontrado' });
      if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No se recibieron archivos' });

      const nuevosDocumentos = req.files.map(file => ({
        name: file.originalname,
        url: file.path,
        size: file.size,
        publicId: file.filename,
        uploadedAt: new Date(),
      }));

      chofer.documentos.push(...nuevosDocumentos);
      await chofer.save();

      res.json({ message: `${req.files.length} archivo(s) subido(s) exitosamente`, documentos: chofer.documentos });
    } catch (error) {
      console.error('Error al guardar documentos del chofer:', error);
      const { status, message } = sanitizeError(error);
      res.status(status).json({ message });
    }
  });
};

export const deleteDocumentoChofer = async (req, res) => {
  try {
    const { id, docId } = req.params;

    const chofer = await Chofer.findById(id);
    if (!chofer) return res.status(404).json({ message: 'Chofer no encontrado' });

    const doc = chofer.documentos.id(docId);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });

    if (doc.publicId) {
      const resourceType = doc.url?.includes('/raw/') ? 'raw' : 'image';
      await cloudinary.uploader.destroy(doc.publicId, { resource_type: resourceType });
    }

    chofer.documentos.pull(docId);
    await chofer.save();

    res.json({ message: 'Documento eliminado exitosamente', documentos: chofer.documentos });
  } catch (error) {
    console.error('Error al eliminar documento del chofer:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};
