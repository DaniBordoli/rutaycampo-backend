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

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const TN_CAMION_COMUN = 30;
const TN_CAMION_ESCALABLE = 37.5;

export const calculatePrice = async (req, res) => {
  try {
    const { origen, destino, distancia: distanciaManual, camionesComunes = 0, camionesEscalables = 0 } = req.body;

    const config = await Tarifa.findOne({ esConfiguracionGlobal: true });
    if (!config || !config.rangosKm?.length) {
      return res.status(404).json({
        message: 'No hay tarifa configurada. El equipo te contactará con un precio.',
      });
    }

    // Calcular distancia con haversine si no viene provista
    let distanciaKm = distanciaManual;
    const origenCoord = origen?.coordenadas;
    const destinoCoord = destino?.coordenadas;
    if (
      !distanciaKm &&
      origenCoord?.latitud && origenCoord?.longitud &&
      destinoCoord?.latitud && destinoCoord?.longitud
    ) {
      distanciaKm = Math.round(haversineKm(
        origenCoord.latitud, origenCoord.longitud,
        destinoCoord.latitud, destinoCoord.longitud
      ));
    }

    if (!distanciaKm) {
      return res.status(400).json({
        message: 'No se pudo determinar la distancia entre origen y destino.',
      });
    }

    const rango = config.rangosKm.find(r => distanciaKm >= r.startKm && distanciaKm <= r.endKm);
    if (!rango) {
      return res.status(404).json({
        message: `No hay tarifa configurada para ${distanciaKm} km. El equipo te contactará con un precio.`,
      });
    }

    const tarifaKmTn = rango.precioPorTonelada;

    // precio por camión = tn_fijas × km × tarifa_km_tn
    const precioCamionComun = TN_CAMION_COMUN * distanciaKm * tarifaKmTn;
    const precioCamionEscalable = TN_CAMION_ESCALABLE * distanciaKm * tarifaKmTn;

    const totalComunes = precioCamionComun * Number(camionesComunes);
    const totalEscalables = precioCamionEscalable * Number(camionesEscalables);
    const total = totalComunes + totalEscalables;

    res.json({
      tarifaKmTn,
      distanciaKm,
      precioCamionComun,
      precioCamionEscalable,
      totalComunes,
      totalEscalables,
      total,
      rango: { startKm: rango.startKm, endKm: rango.endKm },
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getRoute = async (req, res) => {
  const { originLat, originLng, destLat, destLng } = req.body;
  if (!originLat || !originLng || !destLat || !destLng) {
    return res.status(400).json({ message: 'Coordenadas requeridas' });
  }
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
          destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ message: data.error?.message || 'Error al obtener ruta' });
    }
    res.json(data);
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};
