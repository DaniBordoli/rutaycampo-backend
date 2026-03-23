import Camion from '../models/Camion.model.js';
import Transportista from '../models/Transportista.model.js';
import Chofer from '../models/Chofer.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { upload, uploadToSupabaseMultiple } from '../middleware/upload.js';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const createCamion = async (req, res) => {
  try {
    const { transportista, patente, marca, modelo, año, tipo, capacidad, unidadCapacidad, escalable, seguro, vtv, notas } = req.body;

    // Verificar si existe como Transportista o como Chofer independiente
    const transportistaExists = await Transportista.findById(transportista);
    const choferExists = await Chofer.findById(transportista);
    
    if (!transportistaExists && !choferExists) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    const patenteExists = await Camion.findOne({ patente: patente.toUpperCase() });
    if (patenteExists) {
      return res.status(400).json({ message: 'Ya existe un camión con esa patente' });
    }

    const camion = new Camion({
      transportista,
      patente: patente.toUpperCase(),
      marca,
      modelo,
      año,
      tipo,
      capacidad,
      unidadCapacidad,
      escalable,
      seguro,
      vtv,
      notas
    });

    await camion.save();
    await camion.populate('transportista', 'razonSocial cuit');

    res.status(201).json({
      message: 'Camión creado exitosamente',
      camion
    });
  } catch (error) {
    console.error('Error al crear camión:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getCamiones = async (req, res) => {
  try {
    const { transportista, disponible, activo, tipo } = req.query;
    
    const filter = {};
    if (transportista) filter.transportista = transportista;
    if (disponible !== undefined) filter.disponible = disponible === 'true';
    if (activo !== undefined) filter.activo = activo === 'true';
    if (tipo) filter.tipo = tipo;

    const camiones = await Camion.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      total: camiones.length,
      camiones
    });
  } catch (error) {
    console.error('Error al obtener camiones:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getCamionById = async (req, res) => {
  try {
    const camion = await Camion.findById(req.params.id)
      .populate('transportista', 'razonSocial cuit numeroWhatsapp email');

    if (!camion) {
      return res.status(404).json({ message: 'Camión no encontrado' });
    }

    res.json(camion);
  } catch (error) {
    console.error('Error al obtener camión:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateCamion = async (req, res) => {
  try {
    const { patente, marca, modelo, año, tipo, capacidad, unidadCapacidad, escalable, seguro, vtv, disponible, activo, notas } = req.body;

    const camion = await Camion.findById(req.params.id);
    if (!camion) {
      return res.status(404).json({ message: 'Camión no encontrado' });
    }

    const anterior = camion.toObject();

    if (patente && patente.toUpperCase() !== camion.patente) {
      const patenteExists = await Camion.findOne({ 
        patente: patente.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (patenteExists) {
        return res.status(400).json({ message: 'Ya existe un camión con esa patente' });
      }
      camion.patente = patente.toUpperCase();
    }

    if (marca !== undefined) camion.marca = marca;
    if (modelo !== undefined) camion.modelo = modelo;
    if (año !== undefined) camion.año = año;
    if (tipo !== undefined) camion.tipo = tipo;
    if (capacidad !== undefined) camion.capacidad = capacidad;
    if (unidadCapacidad !== undefined) camion.unidadCapacidad = unidadCapacidad;
    if (escalable !== undefined) camion.escalable = escalable;
    if (seguro !== undefined) camion.seguro = seguro;
    if (vtv !== undefined) camion.vtv = vtv;
    if (disponible !== undefined) camion.disponible = disponible;
    if (activo !== undefined) camion.activo = activo;
    if (notas !== undefined) camion.notas = notas;

    await camion.save();
    await camion.populate('transportista', 'razonSocial cuit');

    const camposAuditables = ['patente', 'marca', 'modelo', 'año', 'tipo', 'capacidad', 'unidadCapacidad', 'escalable', 'disponible', 'activo', 'notas'];
    const valorAnterior = {};
    const valorNuevo = {};
    camposAuditables.forEach(campo => {
      if (JSON.stringify(anterior[campo]) !== JSON.stringify(camion[campo])) {
        valorAnterior[campo] = anterior[campo];
        valorNuevo[campo] = camion[campo];
      }
    });

    if (Object.keys(valorNuevo).length > 0) {
      await registrarAuditoria({
        entidad: 'camion',
        entidadId: camion._id,
        accion: 'editar',
        descripcion: `Camión editado: ${camion.patente}`,
        valorAnterior,
        valorNuevo,
        realizadoPor: req.user._id,
        ip: req.ip
      });
    }

    res.json({
      message: 'Camión actualizado exitosamente',
      camion
    });
  } catch (error) {
    console.error('Error al actualizar camión:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const deleteCamion = async (req, res) => {
  try {
    const camion = await Camion.findById(req.params.id);
    if (!camion) {
      return res.status(404).json({ message: 'Camión no encontrado' });
    }

    await Camion.findByIdAndDelete(req.params.id);

    res.json({ message: 'Camión eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar camión:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const toggleDisponibilidad = async (req, res) => {
  try {
    const camion = await Camion.findById(req.params.id);
    if (!camion) {
      return res.status(404).json({ message: 'Camión no encontrado' });
    }

    const disponibleAnterior = camion.disponible;
    camion.disponible = !camion.disponible;
    await camion.save();
    await camion.populate('transportista', 'razonSocial cuit');

    await registrarAuditoria({
      entidad: 'camion',
      entidadId: camion._id,
      accion: camion.disponible ? 'activar' : 'desactivar',
      descripcion: `Camión marcado como ${camion.disponible ? 'disponible' : 'no disponible'}: ${camion.patente}`,
      valorAnterior: { disponible: disponibleAnterior },
      valorNuevo: { disponible: camion.disponible },
      realizadoPor: req.user._id,
      ip: req.ip
    });

    res.json({
      message: `Camión ${camion.disponible ? 'disponible' : 'no disponible'}`,
      camion
    });
  } catch (error) {
    console.error('Error al cambiar disponibilidad:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getCamionesByTransportista = async (req, res) => {
  try {
    const { transportistaId } = req.params;

    const transportista = await Transportista.findById(transportistaId);
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    const camiones = await Camion.find({ transportista: transportistaId })
      .sort({ createdAt: -1 });

    res.json({
      transportista: {
        _id: transportista._id,
        razonSocial: transportista.razonSocial,
        cuit: transportista.cuit
      },
      total: camiones.length,
      camiones
    });
  } catch (error) {
    console.error('Error al obtener camiones del transportista:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const assignCamionToTransportista = async (req, res) => {
  try {
    const { camionId } = req.params;
    const { transportistaId } = req.body;

    const camion = await Camion.findById(camionId);
    if (!camion) {
      return res.status(404).json({ message: 'Camión no encontrado' });
    }

    const transportista = await Transportista.findById(transportistaId);
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    // Verificar si el transportista ya tiene un camión asignado
    const existingCamion = await Camion.findOne({ transportista: transportistaId });
    if (existingCamion && existingCamion._id.toString() !== camionId) {
      // Desasignar el camión anterior (dejarlo sin transportista)
      existingCamion.transportista = null;
      await existingCamion.save();
    }

    camion.transportista = transportistaId;
    await camion.save();
    await camion.populate('transportista', 'razonSocial cuit');

    res.json({
      message: 'Camión asignado exitosamente',
      camion
    });
  } catch (error) {
    console.error('Error al asignar camión:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const uploadDocumentosHandler = [
  upload.array('documentos', 10),
  uploadToSupabaseMultiple(process.env.SUPABASE_BUCKET || 'documentos', 'camiones'),
  async (req, res) => {
    try {
      const camion = await Camion.findById(req.params.id);
      if (!camion) return res.status(404).json({ message: 'Camión no encontrado' });
      if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No se recibieron archivos' });

      const nuevosDocumentos = req.files.map(file => ({
        url: file.publicUrl,
        nombre: file.originalname,
        tipo: file.mimetype,
        storagePath: file.storagePath,
        subidoEn: new Date(),
      }));

      camion.documentos.push(...nuevosDocumentos);
      await camion.save();

      res.json({ message: `${req.files.length} archivo(s) subido(s) exitosamente`, documentos: camion.documentos });
    } catch (error) {
      console.error('Error al guardar documentos:', error);
      const { status, message } = sanitizeError(error);
      res.status(status).json({ message });
    }
  }
];

export const deleteDocumento = async (req, res) => {
  try {
    const { id, docId } = req.params;

    const camion = await Camion.findById(id);
    if (!camion) {
      return res.status(404).json({ message: 'Camión no encontrado' });
    }

    const doc = camion.documentos.id(docId);
    if (!doc) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    if (doc.storagePath) {
      const client = getSupabase();
      await client.storage.from(process.env.SUPABASE_BUCKET || 'documentos').remove([doc.storagePath]);
    }

    camion.documentos.pull(docId);
    await camion.save();

    res.json({ message: 'Documento eliminado exitosamente', documentos: camion.documentos });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};
