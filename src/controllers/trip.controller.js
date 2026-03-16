import Viaje from '../models/Viaje.model.js';
import Tarifa from '../models/Tarifa.model.js';
import { io } from '../server.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import { registrarAuditoria } from '../utils/auditoria.js';

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcularPrecioTentativo = async (distanciaKm, peso) => {
  const config = await Tarifa.findOne({ esConfiguracionGlobal: true });
  if (!config || !config.rangosKm?.length) return null;
  const rango = config.rangosKm.find(r => distanciaKm >= r.startKm && distanciaKm <= r.endKm);
  if (!rango) return null;
  return Math.round(rango.precioPorTonelada * peso);
};


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

    // Calcular distanciaKm desde coordenadas si no viene provista
    const origenCoord = viajeData.origen?.coordenadas;
    const destinoCoord = viajeData.destino?.coordenadas;
    if (
      !viajeData.distanciaKm &&
      origenCoord?.latitud && origenCoord?.longitud &&
      destinoCoord?.latitud && destinoCoord?.longitud
    ) {
      viajeData.distanciaKm = Math.round(haversineKm(
        origenCoord.latitud, origenCoord.longitud,
        destinoCoord.latitud, destinoCoord.longitud
      ));
    }

    const viaje = await Viaje.create(viajeData);
    if (viaje.productor) {
      await viaje.populate('productor');
    }

    await registrarAuditoria({
      realizadoPor: req.user._id,
      accion: 'crear',
      entidad: 'viaje',
      entidadId: viaje._id,
      descripcion: `Viaje ${viaje.numeroViaje} creado desde ${viaje.origen?.ciudad} a ${viaje.destino?.ciudad}`,
      valorNuevo: {
        numeroViaje: viaje.numeroViaje,
        origen: viaje.origen?.ciudad,
        destino: viaje.destino?.ciudad,
        peso: viaje.peso,
        precioBase: viaje.precios?.precioBase ?? null,
      },
      ip: req.ip,
    });

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

export const confirmarTarifa = async (req, res) => {
  try {
    const { precioSistema, precioProductor, precioFinal, pagoChofer, notas } = req.body;

    if (!precioFinal || !pagoChofer) {
      return res.status(400).json({ message: 'precioFinal y pagoChofer son requeridos' });
    }

    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const anterior = {
      precios: { ...viaje.precios?.toObject?.() ?? viaje.precios },
      estado: viaje.estado,
    };

    if (!viaje.precios) viaje.precios = {};
    if (precioSistema) {
      viaje.precios.precioBase = precioSistema;
      viaje.precios.tarifaKmTn = precioSistema;
    }
    if (precioProductor) viaje.precios.precioPropuesto = precioProductor;
    viaje.precios.precioConfirmado = precioFinal;
    viaje.precios.precioFinal = precioFinal;
    viaje.pagoChofer = pagoChofer;
    if (notas) viaje.notas = notas;
    if (viaje.estado !== 'en_curso' && viaje.estado !== 'finalizado') {
      viaje.estado = 'confirmado';
    }

    await viaje.save();
    await viaje.populate('productor transportista');

    await registrarAuditoria({
      realizadoPor: req.user._id,
      accion: 'editar',
      entidad: 'viaje',
      entidadId: viaje._id,
      descripcion: `Tarifa confirmada para viaje ${viaje.numeroViaje}: $${precioFinal}`,
      valorAnterior: anterior,
      valorNuevo: { precios: viaje.precios, pagoChofer, estado: viaje.estado },
      ip: req.ip,
    });

    res.json({ message: 'Tarifa confirmada exitosamente', trip: viaje });
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

    if (!viaje.precios) viaje.precios = {};
    viaje.precios.precioPropuesto = price;
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

