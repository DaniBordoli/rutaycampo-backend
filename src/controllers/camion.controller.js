import Camion from '../models/Camion.model.js';
import Transportista from '../models/Transportista.model.js';

export const createCamion = async (req, res) => {
  try {
    const { transportista, patente, marca, modelo, año, tipo, capacidad, unidadCapacidad, seguro, vtv, notas } = req.body;

    const transportistaExists = await Transportista.findById(transportista);
    if (!transportistaExists) {
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
    res.status(500).json({ message: error.message });
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
      .populate('transportista', 'razonSocial cuit numeroWhatsapp')
      .sort({ createdAt: -1 });

    res.json({
      total: camiones.length,
      camiones
    });
  } catch (error) {
    console.error('Error al obtener camiones:', error);
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};

export const updateCamion = async (req, res) => {
  try {
    const { patente, marca, modelo, año, tipo, capacidad, unidadCapacidad, seguro, vtv, disponible, activo, notas } = req.body;

    const camion = await Camion.findById(req.params.id);
    if (!camion) {
      return res.status(404).json({ message: 'Camión no encontrado' });
    }

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
    if (seguro !== undefined) camion.seguro = seguro;
    if (vtv !== undefined) camion.vtv = vtv;
    if (disponible !== undefined) camion.disponible = disponible;
    if (activo !== undefined) camion.activo = activo;
    if (notas !== undefined) camion.notas = notas;

    await camion.save();
    await camion.populate('transportista', 'razonSocial cuit');

    res.json({
      message: 'Camión actualizado exitosamente',
      camion
    });
  } catch (error) {
    console.error('Error al actualizar camión:', error);
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};

export const toggleDisponibilidad = async (req, res) => {
  try {
    const camion = await Camion.findById(req.params.id);
    if (!camion) {
      return res.status(404).json({ message: 'Camión no encontrado' });
    }

    camion.disponible = !camion.disponible;
    await camion.save();
    await camion.populate('transportista', 'razonSocial cuit');

    res.json({
      message: `Camión ${camion.disponible ? 'disponible' : 'no disponible'}`,
      camion
    });
  } catch (error) {
    console.error('Error al cambiar disponibilidad:', error);
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};
