import Viaje from '../models/Viaje.model.js';
import crypto from 'crypto';
import { io } from '../server.js';

// Generar token único para tracking
export const generateTrackingToken = async (req, res) => {
  try {
    const { id } = req.params;
    
    const viaje = await Viaje.findById(id);
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    // Generar token único si no existe
    if (!viaje.trackingToken) {
      viaje.trackingToken = crypto.randomBytes(32).toString('hex');
      await viaje.save();
    }

    const trackingUrl = `${process.env.TRACKING_URL || 'http://localhost:5175'}/track/${viaje.trackingToken}`;

    res.json({
      trackingToken: viaje.trackingToken,
      trackingUrl,
      viaje: {
        _id: viaje._id,
        numeroViaje: viaje.numeroViaje
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener información del viaje por token (sin autenticación)
export const getViajeByToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    const viaje = await Viaje.findOne({ trackingToken: token })
      .populate('productor', 'razonSocial')
      .populate('transportista', 'razonSocial');

    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado o token inválido' });
    }

    res.json({
      viaje: {
        _id: viaje._id,
        numeroViaje: viaje.numeroViaje,
        origen: viaje.origen,
        destino: viaje.destino,
        fechaProgramada: viaje.fechaProgramada,
        estado: viaje.estado,
        productor: viaje.productor?.razonSocial,
        transportista: viaje.transportista?.razonSocial,
        trackingActivo: viaje.trackingActivo
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Iniciar tracking
export const startTracking = async (req, res) => {
  try {
    const { token } = req.params;
    
    const viaje = await Viaje.findOne({ trackingToken: token });
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado o token inválido' });
    }

    viaje.trackingActivo = true;
    await viaje.save();

    // Notificar al dashboard via WebSocket
    io.to(`trip-${viaje._id}`).emit('tracking-started', {
      tripId: viaje._id,
      timestamp: new Date()
    });

    res.json({ message: 'Tracking iniciado', trackingActivo: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Detener tracking
export const stopTracking = async (req, res) => {
  try {
    const { token } = req.params;
    
    const viaje = await Viaje.findOne({ trackingToken: token });
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado o token inválido' });
    }

    viaje.trackingActivo = false;
    await viaje.save();

    // Notificar al dashboard via WebSocket
    io.to(`trip-${viaje._id}`).emit('tracking-stopped', {
      tripId: viaje._id,
      timestamp: new Date()
    });

    res.json({ message: 'Tracking detenido', trackingActivo: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Actualizar ubicación en tiempo real
export const updateLocation = async (req, res) => {
  try {
    const { token } = req.params;
    const { latitude, longitude, speed, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitud y longitud son requeridas' });
    }

    const viaje = await Viaje.findOne({ trackingToken: token });
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado o token inválido' });
    }

    if (!viaje.trackingActivo) {
      return res.status(400).json({ message: 'El tracking no está activo para este viaje' });
    }

    // Actualizar ubicación actual
    viaje.ubicacionActual = {
      latitud: parseFloat(latitude),
      longitud: parseFloat(longitude),
      ultimaActualizacion: new Date()
    };

    // Agregar a ruta completa
    if (!viaje.rutaCompleta) {
      viaje.rutaCompleta = [];
    }

    viaje.rutaCompleta.push({
      latitud: parseFloat(latitude),
      longitud: parseFloat(longitude),
      timestamp: new Date(),
      velocidad: speed ? parseFloat(speed) : undefined,
      precision: accuracy ? parseFloat(accuracy) : undefined
    });

    await viaje.save();

    // Emitir actualización en tiempo real via WebSocket
    io.to(`trip-${viaje._id}`).emit('location-updated', {
      tripId: viaje._id,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date(),
        speed,
        accuracy
      }
    });

    res.json({ 
      message: 'Ubicación actualizada',
      location: viaje.ubicacionActual,
      totalPoints: viaje.rutaCompleta.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};
