import Tarifa from '../models/Tarifa.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';


export const createRate = async (req, res) => {
  try {
    const tarifa = await Tarifa.create(req.body);
    res.status(201).json({
      message: 'Tarifa creada exitosamente',
      rate: tarifa
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getRates = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    
    if (isActive !== undefined) {
      filter.activo = isActive === 'true';
    }

    const tarifas = await Tarifa.find(filter).sort({ createdAt: -1 });
    res.json({ rates: tarifas });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getRateById = async (req, res) => {
  try {
    const tarifa = await Tarifa.findById(req.params.id);
    
    if (!tarifa) {
      return res.status(404).json({ message: 'Tarifa no encontrada' });
    }

    res.json({ rate: tarifa });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateRate = async (req, res) => {
  try {
    const tarifa = await Tarifa.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!tarifa) {
      return res.status(404).json({ message: 'Tarifa no encontrada' });
    }

    res.json({
      message: 'Tarifa actualizada exitosamente',
      rate: tarifa
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const deleteRate = async (req, res) => {
  try {
    const tarifa = await Tarifa.findByIdAndDelete(req.params.id);

    if (!tarifa) {
      return res.status(404).json({ message: 'Tarifa no encontrada' });
    }

    res.json({
      message: 'Tarifa eliminada exitosamente'
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const calculatePrice = async (req, res) => {
  try {
    const { origen, destino, distancia, peso } = req.body;

    const tarifa = await Tarifa.findOne({
      activo: true,
      'origen.provincia': origen?.provincia,
      'destino.provincia': destino?.provincia
    }).sort({ createdAt: -1 });

    if (!tarifa) {
      return res.status(404).json({ 
        message: 'No se encontró tarifa para esta ruta' 
      });
    }

    let precioCalculado = tarifa.precioBase || 0;

    if (tarifa.precioPorKm && distancia) {
      precioCalculado += tarifa.precioPorKm * distancia;
    }

    if (tarifa.precioPorTonelada && peso) {
      precioCalculado += tarifa.precioPorTonelada * peso;
    }

    res.json({
      basePrice: precioCalculado,
      rate: {
        id: tarifa._id,
        origen: tarifa.origen,
        destino: tarifa.destino
      }
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

