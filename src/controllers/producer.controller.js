import Productor from '../models/Productor.model.js';

export const createProducer = async (req, res) => {
  try {
    const productor = await Productor.create(req.body);
    res.status(201).json({
      message: 'Productor creado exitosamente',
      producer: productor
    });
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
    const productor = await Productor.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );

    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    res.json({
      message: 'Productor desactivado exitosamente',
      producer: productor
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
