import Viaje from '../models/Viaje.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';

// Obtener datos del viaje por token del slot (sin autenticación)
export const getSlotByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const viaje = await Viaje.findOne({ 'camionesAsignados.trackingToken': token });
    if (!viaje) {
      return res.status(404).json({ message: 'Token inválido o expirado' });
    }
    const slot = viaje.camionesAsignados.find(s => s.trackingToken === token);
    res.json({
      viajeId: viaje._id,
      slotId: slot._id,
      numeroViaje: viaje.numeroViaje,
      origen: viaje.origen,
      destino: viaje.destino,
      fechaProgramada: viaje.fechaProgramada,
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

// Recibir coordenadas del chofer por token del slot
export const updateSlotLocation = async (req, res) => {
  try {
    const { token } = req.params;
    const { latitude, longitude, speed, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitud y longitud son requeridas' });
    }

    const viaje = await Viaje.findOne({ 'camionesAsignados.trackingToken': token });
    if (!viaje) {
      return res.status(404).json({ message: 'Token inválido o expirado' });
    }

    const slot = viaje.camionesAsignados.find(s => s.trackingToken === token);

    // Guardar en ubicacionActual del viaje (última posición conocida)
    viaje.ubicacionActual = {
      latitud: parseFloat(latitude),
      longitud: parseFloat(longitude),
      ultimaActualizacion: new Date()
    };

    // Agregar al historial de ruta del viaje
    viaje.rutaCompleta = viaje.rutaCompleta || [];
    viaje.rutaCompleta.push({
      latitud: parseFloat(latitude),
      longitud: parseFloat(longitude),
      timestamp: new Date(),
      velocidad: speed ? parseFloat(speed) : undefined,
      precision: accuracy ? parseFloat(accuracy) : undefined
    });

    await viaje.save();

    res.json({ message: 'Ubicación actualizada' });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

// Obtener ruta completa del viaje
export const getRutaCompleta = async (req, res) => {
  try {
    const { id } = req.params;
    
    const viaje = await Viaje.findById(id).select('rutaCompleta ubicacionActual trackingActivo');
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    res.json({
      rutaCompleta: viaje.rutaCompleta || [],
      ubicacionActual: viaje.ubicacionActual,
      trackingActivo: viaje.trackingActivo,
      totalPoints: viaje.rutaCompleta?.length || 0
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

