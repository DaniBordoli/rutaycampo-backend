import Tarifa from '../models/Tarifa.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import { registrarAuditoria } from '../utils/auditoria.js';

const validarRangos = (rangos) => {
  if (!Array.isArray(rangos) || rangos.length === 0) {
    return 'Debe haber al menos un rango.';
  }
  for (const r of rangos) {
    if (r.startKm < 0 || r.endKm < 0) return 'Los kilómetros no pueden ser negativos.';
    if (r.endKm <= r.startKm) return `El rango ${r.startKm}-${r.endKm} km es inválido: el final debe ser mayor al inicio.`;
    if (!Number.isInteger(r.precioPorTonelada) || r.precioPorTonelada <= 0) {
      return 'El precio por tonelada debe ser un número entero positivo.';
    }
  }
  const sorted = [...rangos].sort((a, b) => a.startKm - b.startKm);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].endKm >= sorted[i + 1].startKm) {
      return `El rango ${sorted[i].startKm}-${sorted[i].endKm} km se superpone con ${sorted[i+1].startKm}-${sorted[i+1].endKm} km.`;
    }
  }
  return null;
};

export const getConfigRangos = async (req, res) => {
  try {
    const config = await Tarifa.findOne({ esConfiguracionGlobal: true });
    res.json({ rangos: config?.rangosKm || [] });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const saveConfigRangos = async (req, res) => {
  try {
    const { rangos } = req.body;
    const errorMsg = validarRangos(rangos);
    if (errorMsg) return res.status(400).json({ message: errorMsg });

    const anterior = await Tarifa.findOne({ esConfiguracionGlobal: true });
    const config = await Tarifa.findOneAndUpdate(
      { esConfiguracionGlobal: true },
      { esConfiguracionGlobal: true, rangosKm: rangos, activo: true },
      { upsert: true, new: true, runValidators: true }
    );

    await registrarAuditoria({
      realizadoPor: req.user._id,
      accion: anterior ? 'editar' : 'crear',
      entidad: 'tarifa',
      entidadId: config._id,
      descripcion: anterior ? 'Actualización de configuración de rangos de tarifas por km' : 'Creación de configuración de rangos de tarifas por km',
      valorAnterior: anterior ? { rangosKm: anterior.rangosKm } : null,
      valorNuevo: { rangosKm: rangos },
      ip: req.ip,
    });

    res.json({ message: 'Configuración de tarifas guardada exitosamente', rangos: config.rangosKm });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};


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

