import Transportista from '../models/Transportista.model.js';
import Camion from '../models/Camion.model.js';

export const createTransportista = async (req, res) => {
  try {
    const transportista = await Transportista.create(req.body);
    res.status(201).json({
      message: 'Transportista creado exitosamente',
      transportista
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};

export const updateTransportista = async (req, res) => {
  try {
    const transportista = await Transportista.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!transportista) {
      return res.status(404).json({ message: 'Transportista no encontrado' });
    }
    res.json({
      message: 'Transportista actualizado exitosamente',
      transportista
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};
