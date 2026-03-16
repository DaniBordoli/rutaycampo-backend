import Transportista from '../models/Transportista.model.js';
import Camion from '../models/Camion.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import { registrarAuditoria } from '../utils/auditoria.js';


export const createTransportista = async (req, res) => {
  try {
    const transportista = await Transportista.create(req.body);
    res.status(201).json({
      message: 'Transportista creado exitosamente',
      transportista
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getTransportistas = async (req, res) => {
  try {
    const { isActive, isAvailable } = req.query;
    const filter = {};
    
    if (isActive !== undefined) {
      filter.activo = isActive === 'true';
    }
    if (isAvailable !== undefined) {
      filter.disponible = isAvailable === 'true';
    }

    const transportistas = await Transportista.find(filter).sort({ razonSocial: 1 });
    
    const transportistasWithCamiones = await Promise.all(
      transportistas.map(async (transportista) => {
        const camiones = await Camion.find({ transportista: transportista._id });
        return {
          ...transportista.toObject(),
          camiones
        };
      })
    );
    
    res.json(transportistasWithCamiones);
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getTransportistaById = async (req, res) => {
  try {
    const transportista = await Transportista.findById(req.params.id);
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    const camiones = await Camion.find({ transportista: req.params.id });

    res.json({
      ...transportista.toObject(),
      camiones
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateTransportista = async (req, res) => {
  try {
    const anterior = await Transportista.findById(req.params.id);
    if (!anterior) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    const transportista = await Transportista.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    const camposAuditables = ['razonSocial', 'cuit', 'nombre', 'numeroWhatsapp', 'email', 'notas'];
    const valorAnterior = {};
    const valorNuevo = {};
    camposAuditables.forEach(campo => {
      if (JSON.stringify(anterior[campo]) !== JSON.stringify(transportista[campo])) {
        valorAnterior[campo] = anterior[campo];
        valorNuevo[campo] = transportista[campo];
      }
    });

    if (Object.keys(valorNuevo).length > 0) {
      await registrarAuditoria({
        entidad: 'transportista',
        entidadId: transportista._id,
        accion: 'editar',
        descripcion: `Transportista editado: ${transportista.razonSocial}`,
        valorAnterior,
        valorNuevo,
        realizadoPor: req.user._id,
        ip: req.ip
      });
    }

    res.json({
      message: 'Transportista actualizado exitosamente',
      transportista
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const deleteTransportista = async (req, res) => {
  try {
    const transportista = await Transportista.findByIdAndDelete(req.params.id);
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }
    res.json({ message: 'Transportista eliminado exitosamente' });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const toggleAvailability = async (req, res) => {
  try {
    const transportista = await Transportista.findById(req.params.id);
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }
    
    transportista.disponible = !transportista.disponible;
    await transportista.save();
    
    res.json({
      message: `Transportista ${transportista.disponible ? 'disponible' : 'no disponible'}`,
      transportista
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const deactivateTransportista = async (req, res) => {
  try {
    const { desactivadoHasta } = req.body;
    const transportista = await Transportista.findById(req.params.id);
    
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    transportista.activo = false;
    transportista.desactivadoHasta = desactivadoHasta || null;
    await transportista.save();

    await registrarAuditoria({
      entidad: 'transportista',
      entidadId: transportista._id,
      accion: 'desactivar',
      descripcion: desactivadoHasta
        ? `Transportista desactivado hasta ${new Date(desactivadoHasta).toLocaleDateString('es-AR')}: ${transportista.razonSocial}`
        : `Transportista desactivado indefinidamente: ${transportista.razonSocial}`,
      valorAnterior: { activo: true },
      valorNuevo: { activo: false, desactivadoHasta: desactivadoHasta || null },
      realizadoPor: req.user._id,
      ip: req.ip
    });

    const message = desactivadoHasta 
      ? `Transportista desactivado hasta ${new Date(desactivadoHasta).toLocaleDateString('es-AR')}`
      : 'Transportista desactivado indefinidamente';

    res.json({
      message,
      transportista
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const activateTransportista = async (req, res) => {
  try {
    const transportista = await Transportista.findById(req.params.id);
    
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    transportista.activo = true;
    transportista.desactivadoHasta = null;
    await transportista.save();

    await registrarAuditoria({
      entidad: 'transportista',
      entidadId: transportista._id,
      accion: 'activar',
      descripcion: `Transportista activado: ${transportista.razonSocial}`,
      valorAnterior: { activo: false },
      valorNuevo: { activo: true },
      realizadoPor: req.user._id,
      ip: req.ip
    });

    res.json({
      message: 'Transportista activado exitosamente',
      transportista
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const checkAndReactivateTransportistas = async () => {
  try {
    const now = new Date();
    const transportistasToReactivate = await Transportista.find({
      activo: false,
      desactivadoHasta: { $lte: now, $ne: null }
    });

    for (const transportista of transportistasToReactivate) {
      transportista.activo = true;
      transportista.desactivadoHasta = null;
      await transportista.save();
      console.log(`Transportista ${transportista.razonSocial} reactivado automáticamente`);
    }

    return transportistasToReactivate.length;
  } catch (error) {
    console.error('Error al reactivar transportistas:', error);
    return 0;
  }
};

