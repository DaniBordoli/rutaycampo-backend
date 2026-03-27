import Viaje from '../models/Viaje.model.js';
import Tarifa from '../models/Tarifa.model.js';
import Chofer from '../models/Chofer.model.js';
import Transportista from '../models/Transportista.model.js';
import Usuario from '../models/Usuario.model.js';
import Productor from '../models/Productor.model.js';
import { sanitizeError } from '../utils/sanitizeError.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import emailService from '../services/email.service.js';

const checkYTransicionarDocumentacion = (viaje) => {
  if (viaje.estado !== 'buscando_camiones') return false;
  const totalSlots = viaje.camionesSolicitados || 0;
  if (totalSlots === 0) return false;
  const asignados = viaje.camionesAsignados.filter(
    c => c.camion && c.transportista
  ).length;
  if (asignados >= totalSlots) {
    viaje.estado = 'documentacion';
    return true;
  }
  return false;
};

const notificarDocumentacionAlProductor = async (viaje) => {
  try {
    const productor = await Productor.findById(viaje.productor).lean();
    if (!productor?.emailContacto) return;
    const tripUrl = `${process.env.FRONTEND_PRODUCTORES_URL || 'http://localhost:5173'}/viajes/${viaje._id}`;
    const nombre = productor.nombreContacto || productor.razonSocial;
    await emailService.sendDocumentacionEmail(productor.emailContacto, nombre, viaje.numeroViaje, tripUrl);
  } catch (err) {
    console.error('Error al enviar email de documentación:', err.message);
  }
};

export const checkYTransicionarConfirmado = (viaje) => {
  if (viaje.estado !== 'documentacion') return;
  const totalSlots = viaje.camionesSolicitados || 0;
  if (totalSlots === 0) return;
  const conCarta = viaje.camionesAsignados.filter(
    c => c.cartaDePorte?.ruta
  ).length;
  if (conCarta >= totalSlots) {
    viaje.estado = 'confirmado';
  } else {
    viaje.estado = 'documentacion';
  }
};

const populateViajeConChoferes = async (viaje) => {
  // Guardar los IDs de transportista ANTES del populate
  const transportistaIds = viaje.camionesAsignados.map(t => t.transportista ? String(t.transportista) : null);
  await viaje.populate('productor transportista camionesAsignados.camion');

  // Convertir a objeto plano para poder mutar campos de subdocumentos libremente
  const viajeObj = viaje.toObject({ virtuals: false });

  for (let idx = 0; idx < viajeObj.camionesAsignados.length; idx++) {
    const rawId = transportistaIds[idx];
    if (!rawId) continue;
    const chofer = await Chofer.findById(rawId).lean();
    if (chofer) {
      const esIndependiente = !chofer.transportistas || chofer.transportistas.length === 0;
      let empresaNombre = null;
      if (!esIndependiente && chofer.transportistas?.length > 0) {
        const empresa = await Transportista.findById(chofer.transportistas[0]).lean();
        empresaNombre = empresa?.razonSocial || empresa?.nombre || null;
      }
      viajeObj.camionesAsignados[idx].transportista = {
        _id: String(chofer._id),
        nombre: chofer.nombre,
        esChoferIndependiente: esIndependiente,
        empresaNombre,
      };
    } else {
      // Fallback: dato legacy donde se guardó un Transportista._id
      const transportista = await Transportista.findById(rawId).lean();
      if (transportista) {
        viajeObj.camionesAsignados[idx].transportista = { _id: String(transportista._id), nombre: transportista.nombre || transportista.razonSocial, esLegacyTransportista: true };
      }
    }
  }
  for (const truck of viajeObj.camionesAsignados) {
    if (truck.subEstado === 'pendiente' && truck.camion && truck.transportista) {
      truck.subEstado = 'asignado';
    }
  }
  return viajeObj;
};

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

    const sinNumero = viajes.filter(v => !v.numeroViaje);
    if (sinNumero.length > 0) {
      const totalDocs = await Viaje.countDocuments();
      const savePromises = sinNumero.map(async (v, idx) => {
        v.numeroViaje = `VJ-${String(totalDocs - idx).padStart(6, '0')}`;
        return v.save();
      });
      await Promise.all(savePromises);
    }

    res.json({ trips: viajes });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const getTripById = async (req, res) => {
  try {
    const viaje = await Viaje.findById(req.params.id);

    if (!viaje) {
      return res.status(404).json({ message: 'Viaje no encontrado' });
    }

    const viajePopulado = await populateViajeConChoferes(viaje);
    res.json({ trip: viajePopulado });
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

    if (precioFinal == null || pagoChofer == null) {
      return res.status(400).json({ message: 'precioFinal y pagoChofer son requeridos' });
    }
    if (Number(precioFinal) <= 0 || Number(pagoChofer) <= 0) {
      return res.status(400).json({ message: 'precioFinal y pagoChofer deben ser mayores a 0' });
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
    // Retroactively fill importeChofer on all slots that don't have it set yet
    for (const slot of viaje.camionesAsignados) {
      if (slot.importeChofer == null) {
        slot.importeChofer = pagoChofer;
      }
    }
    if (notas) viaje.notas = notas;
    if (viaje.estado !== 'en_curso' && viaje.estado !== 'finalizado') {
      viaje.estado = 'buscando_camiones';
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

    if (price == null || Number(price) <= 0) {
      return res.status(400).json({ message: 'El precio debe ser mayor a 0' });
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
    viaje.estado = 'confirmado';

    await viaje.save();
    await viaje.populate('productor transportista');


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


    res.json({
      message: 'Check-in registrado exitosamente',
      trip: viaje
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const recalcularEstado = async (req, res) => {
  try {
    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const estadoAnterior = viaje.estado;

    if (viaje.estado === 'buscando_camiones') {
      checkYTransicionarDocumentacion(viaje);
    }
    if (viaje.estado === 'documentacion') {
      checkYTransicionarConfirmado(viaje);
    }

    await viaje.save();

    if (estadoAnterior !== 'documentacion' && viaje.estado === 'documentacion') {
      notificarDocumentacionAlProductor(viaje).catch(console.error);
    }

    res.json({ message: 'Estado recalculado', estadoAnterior, estadoActual: viaje.estado });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const assignCamion = async (req, res) => {
  try {
    const { camionId, transportistaId } = req.body;
    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const existente = viaje.camionesAsignados.find(
      c => c.camion?.toString() === camionId
    );
    if (existente) {
      return res.status(409).json({ message: 'Este camión ya está asignado al viaje' });
    }

    viaje.camionesAsignados.push({
      camion: camionId,
      transportista: transportistaId,
      subEstado: 'asignado',
      importeChofer: viaje.pagoChofer || null
    });

    const transicionoADoc = checkYTransicionarDocumentacion(viaje);
    await viaje.save();
    const viajePopulado = await populateViajeConChoferes(viaje);

    if (transicionoADoc) {
      notificarDocumentacionAlProductor(viaje).catch(console.error);
    }

    await registrarAuditoria({
      realizadoPor: req.user._id,
      accion: 'editar',
      entidad: 'viaje',
      entidadId: viaje._id,
      descripcion: `Camión asignado al viaje ${viaje.numeroViaje}`,
      valorNuevo: { camionId, transportistaId },
      ip: req.ip,
    });

    res.json({ message: 'Camión asignado exitosamente', trip: viajePopulado });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const removeCamion = async (req, res) => {
  try {
    const { camionId } = req.params;
    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const idx = viaje.camionesAsignados.findIndex(
      c => c._id.toString() === camionId || c.camion?.toString() === camionId
    );
    if (idx === -1) return res.status(404).json({ message: 'Camión no encontrado en el viaje' });

    viaje.camionesAsignados.splice(idx, 1);
    if (['documentacion', 'confirmado'].includes(viaje.estado)) {
      viaje.estado = 'buscando_camiones';
    }
    await viaje.save();
    const viajePopulado = await populateViajeConChoferes(viaje);

    res.json({ message: 'Camión removido exitosamente', trip: viajePopulado });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateTruckDriver = async (req, res) => {
  try {
    const { truckId } = req.params;
    const { transportistaId } = req.body;
    
    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const truck = viaje.camionesAsignados.find(c => c._id.toString() === truckId);
    if (!truck) return res.status(404).json({ message: 'Camión no encontrado en el viaje' });

    truck.transportista = transportistaId || null;
    if (transportistaId && truck.camion) {
      truck.subEstado = 'asignado';
    } else if (!transportistaId) {
      truck.subEstado = 'pendiente';
    }
    const transicionoADoc = checkYTransicionarDocumentacion(viaje);
    await viaje.save();
    const viajePopulado = await populateViajeConChoferes(viaje);

    if (transicionoADoc) {
      notificarDocumentacionAlProductor(viaje).catch(console.error);
    }

    res.json({ message: 'Chofer actualizado exitosamente', trip: viajePopulado });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateTruckVehicle = async (req, res) => {
  try {
    const { truckId } = req.params;
    const { camionId } = req.body;
    
    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const truck = viaje.camionesAsignados.find(c => c._id.toString() === truckId);
    if (!truck) return res.status(404).json({ message: 'Camión no encontrado en el viaje' });

    truck.camion = camionId;
    const transicionoADoc = checkYTransicionarDocumentacion(viaje);
    await viaje.save();
    const viajePopulado = await populateViajeConChoferes(viaje);

    if (transicionoADoc) {
      notificarDocumentacionAlProductor(viaje).catch(console.error);
    }

    res.json({ message: 'Camión actualizado exitosamente', trip: viajePopulado });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateTruckStatus = async (req, res) => {
  try {
    const { truckId } = req.params;
    const { subEstado } = req.body;
    
    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const truck = viaje.camionesAsignados.find(c => c._id.toString() === truckId);
    if (!truck) return res.status(404).json({ message: 'Camión no encontrado en el viaje' });

    truck.subEstado = subEstado;
    if (subEstado === 'iniciado' && !truck.fechaInicio) {
      truck.fechaInicio = new Date();
    }
    if (subEstado === 'finalizado' && !truck.fechaFin) {
      truck.fechaFin = new Date();
    }
    await viaje.save();
    const viajePopulado = await populateViajeConChoferes(viaje);

    res.json({ message: 'Estado actualizado exitosamente', trip: viajePopulado });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const checkinCamion = async (req, res) => {
  try {
    const { camionId } = req.params;
    const { tipo, ubicacion, notas } = req.body;

    const SUBESTADO_MAP = {
      en_origen:  'en_origen',
      cargado:    'cargado',
      iniciado:   'iniciado',
      en_destino: 'en_destino',
      finalizado: 'finalizado'
    };

    if (!SUBESTADO_MAP[tipo]) {
      return res.status(400).json({ message: 'Tipo de check-in inválido' });
    }

    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const camionAsignado = viaje.camionesAsignados.find(
      c => c._id.toString() === camionId || c.camion?.toString() === camionId
    );
    if (!camionAsignado) return res.status(404).json({ message: 'Camión no encontrado en el viaje' });

    camionAsignado.checkIns.push({ tipo, ubicacion, notas });
    camionAsignado.subEstado = SUBESTADO_MAP[tipo];

    if (tipo === 'iniciado') {
      if (viaje.estado !== 'en_curso' && viaje.estado !== 'finalizado') {
        viaje.estado = 'en_curso';
      }
      if (!camionAsignado.fechaInicio) {
        camionAsignado.fechaInicio = new Date();
      }
    }
    if (tipo === 'finalizado' && !camionAsignado.fechaFin) {
      camionAsignado.fechaFin = new Date();
    }

    await viaje.save();
    const viajePopulado = await populateViajeConChoferes(viaje);


    res.json({ message: 'Check-in registrado', trip: viajePopulado });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const updateTruckDetail = async (req, res) => {
  try {
    const { importeChofer, adelanto, fechaInicio, fechaFin } = req.body;
    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });

    const slot = viaje.camionesAsignados.id(req.params.truckId);
    if (!slot) return res.status(404).json({ message: 'Camión asignado no encontrado' });

    if (importeChofer !== undefined) slot.importeChofer = importeChofer;
    if (adelanto !== undefined) slot.adelanto = adelanto;
    if (fechaInicio !== undefined) slot.fechaInicio = fechaInicio || null;
    if (fechaFin !== undefined) slot.fechaFin = fechaFin || null;

    await viaje.save();
    const viajePopulado = await populateViajeConChoferes(viaje);
    res.json({ message: 'Detalle del camión actualizado', trip: viajePopulado });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

export const rateTrip = async (req, res) => {
  try {
    const { rating, nota, driverRatings } = req.body;
    const userRole = req.user.rol;

    const viaje = await Viaje.findById(req.params.id);
    if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });
    if (viaje.estado !== 'finalizado') {
      return res.status(400).json({ message: 'Solo se puede puntuar un viaje finalizado' });
    }

    if (userRole === 'productor') {
      // Producer rates overall trip satisfaction
      if (!rating) return res.status(400).json({ message: 'Se requiere una puntuación' });
      viaje.rating = rating;
      viaje.ratingNota = nota || '';
      viaje.ratingFecha = new Date();
    } else {
      // Operador/admin rates individual drivers
      const choferIdsToUpdate = new Set();
      if (driverRatings && driverRatings.length > 0) {
        for (const dr of driverRatings) {
          if (!dr.rating) continue;
          const slot = viaje.camionesAsignados.id(dr.slotId);
          if (slot) {
            slot.rating = dr.rating;
            slot.ratingNota = dr.nota || '';
            if (dr.choferId) choferIdsToUpdate.add(String(dr.choferId));
          }
        }
      }
      viaje.ratingFecha = new Date();
      await viaje.save();

      for (const choferId of choferIdsToUpdate) {
        const allViajes = await Viaje.find({
          'camionesAsignados.transportista': choferId,
          'camionesAsignados.rating': { $exists: true, $ne: null }
        }).lean();
        const allRatings = [];
        for (const v of allViajes) {
          for (const slot of v.camionesAsignados) {
            if (String(slot.transportista) === choferId && slot.rating) {
              allRatings.push(slot.rating);
            }
          }
        }
        if (allRatings.length > 0) {
          const avg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
          await Chofer.findByIdAndUpdate(choferId, { puntuacion: Math.round(avg * 10) / 10 });
        }
      }
    }

    await viaje.save();
    const viajePopulado = await populateViajeConChoferes(await Viaje.findById(viaje._id));
    res.json({ message: 'Puntuación guardada', trip: viajePopulado });
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


    res.json({
      message: 'Ubicación actualizada',
      location: viaje.ubicacionActual
    });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    res.status(status).json({ message });
  }
};

