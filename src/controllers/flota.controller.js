import Flota from '../models/Flota.model.js';
import Transportista from '../models/Transportista.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';


export const createFlota = async (req, res) => {
  try {
    const { nombre, cuit, responsable, telefono, email, prioridad, notas } = req.body;

    const cuitExists = await Flota.findOne({ cuit: cuit.trim() });
    if (cuitExists) {
      return res.status(400).json({ message: 'Ya existe una flota con ese CUIT' });
    }

    const flota = new Flota({
      nombre,
      cuit: cuit.trim(),
      responsable,
      telefono,
      email,
      prioridad,
      notas
    });

    await flota.save();

    res.status(201).json({
      message: 'Flota creada exitosamente',
      flota
    });
  } catch (error) {
    console.error('Error al crear flota:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getFlotas = async (req, res) => {
  try {
    const { activa, prioridad, search } = req.query;
    const filter = {};

    if (activa !== undefined) {
      filter.activa = activa === 'true';
    }

    if (prioridad) {
      filter.prioridad = prioridad;
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

    const flotas = await Flota.find(filter)
      .populate('transportistas', 'razonSocial nombre cuit')
      .sort({ prioridad: -1, nombre: 1 });

    res.json(flotas);
  } catch (error) {
    console.error('Error al obtener flotas:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getFlotaById = async (req, res) => {
  try {
    const flota = await Flota.findById(req.params.id)
      .populate('transportistas', 'razonSocial nombre cuit numeroWhatsapp email');

    if (!flota) {
      return res.status(404).json({ message: 'Flota no encontrada' });
    }

    res.json(flota);
  } catch (error) {
    console.error('Error al obtener flota:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateFlota = async (req, res) => {
  try {
    const { nombre, cuit, responsable, telefono, email, prioridad, activa, notas } = req.body;

    const flota = await Flota.findById(req.params.id);
    if (!flota) {
      return res.status(404).json({ message: 'Flota no encontrada' });
    }

    if (cuit && cuit.trim() !== flota.cuit) {
      const cuitExists = await Flota.findOne({
        cuit: cuit.trim(),
        _id: { $ne: req.params.id }
      });
      if (cuitExists) {
        return res.status(400).json({ message: 'Ya existe una flota con ese CUIT' });
      }
      flota.cuit = cuit.trim();
    }

    if (nombre !== undefined) flota.nombre = nombre;
    if (responsable !== undefined) flota.responsable = responsable;
    if (telefono !== undefined) flota.telefono = telefono;
    if (email !== undefined) flota.email = email;
    if (prioridad !== undefined) flota.prioridad = prioridad;
    if (activa !== undefined) flota.activa = activa;
    if (notas !== undefined) flota.notas = notas;

    await flota.save();
    await flota.populate('transportistas', 'razonSocial nombre cuit');

    res.json({
      message: 'Flota actualizada exitosamente',
      flota
    });
  } catch (error) {
    console.error('Error al actualizar flota:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const deleteFlota = async (req, res) => {
  try {
    const flota = await Flota.findByIdAndDelete(req.params.id);
    if (!flota) {
      return res.status(404).json({ message: 'Flota no encontrada' });
    }

    res.json({ message: 'Flota eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar flota:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const toggleActivaFlota = async (req, res) => {
  try {
    const flota = await Flota.findById(req.params.id);
    if (!flota) {
      return res.status(404).json({ message: 'Flota no encontrada' });
    }

    flota.activa = !flota.activa;
    await flota.save();

    res.json({
      message: `Flota ${flota.activa ? 'activada' : 'desactivada'} exitosamente`,
      flota
    });
  } catch (error) {
    console.error('Error al cambiar estado de flota:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const addTransportistaToFlota = async (req, res) => {
  try {
    const { flotaId } = req.params;
    const { transportistaId } = req.body;

    const flota = await Flota.findById(flotaId);
    if (!flota) {
      return res.status(404).json({ message: 'Flota no encontrada' });
    }

    const transportista = await Transportista.findById(transportistaId);
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }

    if (flota.transportistas.includes(transportistaId)) {
      return res.status(400).json({ message: 'El transportista ya pertenece a esta flota' });
    }

    flota.transportistas.push(transportistaId);
    await flota.save();
    await flota.populate('transportistas', 'razonSocial nombre cuit');

    res.json({
      message: 'Transportista agregado a la flota exitosamente',
      flota
    });
  } catch (error) {
    console.error('Error al agregar transportista a flota:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const removeTransportistaFromFlota = async (req, res) => {
  try {
    const { flotaId, transportistaId } = req.params;

    const flota = await Flota.findById(flotaId);
    if (!flota) {
      return res.status(404).json({ message: 'Flota no encontrada' });
    }

    flota.transportistas = flota.transportistas.filter(
      t => t.toString() !== transportistaId
    );

    await flota.save();
    await flota.populate('transportistas', 'razonSocial nombre cuit');

    res.json({
      message: 'Transportista removido de la flota exitosamente',
      flota
    });
  } catch (error) {
    console.error('Error al remover transportista de flota:', error);
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

