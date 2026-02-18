import Viaje from '../models/Viaje.model.js';
import { io } from '../server.js';
import { sanitizeError } from '../utils/sanitizeError.js';


export const createTrip = async (req, res) => {
  try {
    // Obtener el ID del productor
    let productorId = null;
    if (req.user.rol === 'productor') {
      if (!req.user.productorId) {
        return res.status(400).json({ 
          message: 'Usuario productor no tiene un productor asociado. Contacte al administrador.' 
        });
      }
      productorId = req.user.productorId;
    } else if (req.body.productor) {
      // Solo asignar si viene en el body (opcional para admin/operador)
      productorId = req.body.productor;
    }

    // Generar número de viaje
    const count = await Viaje.countDocuments();
    const numeroViaje = `VJ-${String(count + 1).padStart(6, '0')}`;

    const viajeData = {
      ...req.body,
      numeroViaje
    };

    // Solo agregar productor si existe
    if (productorId) {
      viajeData.productor = productorId;
    }

    const viaje = await Viaje.create(viajeData);
    if (viaje.productor) {
      await viaje.populate('productor');
    }

    res.status(201).json({
      message: 'Viaje creado exitosamente',
      trip: viaje
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getTrips = async (req, res) => {
  try {
    const { status, producer, transportista, startDate, endDate } = req.query;
    const filter = {};

    if (req.user.rol === 'productor') {
      filter.productor = req.user.productorId;
    }

    if (req.user.rol === 'transportista') {
      filter.transportista = req.user.transportistaId;
    }

    if (status) filter.estado = status;
    if (producer) filter.productor = producer;
    if (transportista) filter.transportista = transportista;
    if (startDate || endDate) {
      filter.fechaProgramada = {};
      if (startDate) filter.fechaProgramada.$gte = new Date(startDate);
      if (endDate) filter.fechaProgramada.$lte = new Date(endDate);
    }

    const viajes = await Viaje.find(filter)
      .populate('productor')
      .populate('transportista')
      .sort({ createdAt: -1 });

    res.json({ trips: viajes });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getTripById = async (req, res) => {
  try {
    const viaje = await Viaje.findById(req.params.id)
      .populate('productor')
      .populate('transportista');

    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    res.json({ trip: viaje });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateTrip = async (req, res) => {
  try {
    const viaje = await Viaje.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('productor').populate('transportista');

    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    res.json({
      message: 'Viaje actualizado exitosamente',
      trip: viaje
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateTripStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const viaje = await Viaje.findById(req.params.id);

    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    viaje.estado = status;
    viaje.historialEstados.push({
      estado: status,
      cambiadoPor: req.user.id,
      notas: notes
    });

    await viaje.save();
    await viaje.populate('productor transportista');

    io.to(`trip-${viaje._id}`).emit('status-updated', {
      tripId: viaje._id,
      status: viaje.estado,
      timestamp: new Date()
    });

    res.json({
      message: 'Estado actualizado exitosamente',
      trip: viaje
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const proposePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    const viaje = await Viaje.findById(id);
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    // Verificar que el usuario sea el productor del viaje
    if (req.user.rol === 'productor' && viaje.productor.toString() !== req.user.productorId.toString()) {
      return res.status(403).json({ message: 'No tienes permiso para proponer precio en este viaje' });
    }

    viaje.precioPropuesto = price;
    await viaje.save();

    res.json({
      message: 'Precio propuesto exitosamente',
      trip: viaje
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const deleteTrip = async (req, res) => {
  try {
    const viaje = await Viaje.findByIdAndDelete(req.params.id);
    
    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    res.json({ message: 'Viaje eliminado exitosamente' });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const assignTransportista = async (req, res) => {
  try {
    const { transportistaId } = req.body;
    const viaje = await Viaje.findById(req.params.id);

    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    viaje.transportista = transportistaId;
    viaje.estado = 'en_curso';

    await viaje.save();
    await viaje.populate('productor transportista');

    io.to(`trip-${viaje._id}`).emit('transportista-assigned', {
      tripId: viaje._id,
      transportista: viaje.transportista
    });

    res.json({
      message: 'Transportista asignado exitosamente',
      trip: viaje
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const addCheckIn = async (req, res) => {
  try {
    const { type, location, notes } = req.body;
    const viaje = await Viaje.findById(req.params.id);

    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    viaje.checkIns.push({
      tipo: type,
      ubicacion: location,
      notas: notes
    });

    if (location) {
      viaje.ubicacionActual = {
        latitud: location.latitude,
        longitud: location.longitude,
        ultimaActualizacion: new Date()
      };
    }

    await viaje.save();

    io.to(`trip-${viaje._id}`).emit('check-in', {
      tripId: viaje._id,
      checkIn: viaje.checkIns[viaje.checkIns.length - 1]
    });

    res.json({
      message: 'Check-in registrado exitosamente',
      trip: viaje
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const viaje = await Viaje.findById(req.params.id);

    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    viaje.ubicacionActual = {
      latitud: latitude,
      longitud: longitude,
      ultimaActualizacion: new Date()
    };

    await viaje.save();

    io.to(`trip-${viaje._id}`).emit('location-updated', {
      tripId: viaje._id,
      location: viaje.ubicacionActual
    });

    res.json({
      message: 'Ubicación actualizada',
      location: viaje.ubicacionActual
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

