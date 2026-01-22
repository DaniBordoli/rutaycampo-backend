import Productor from '../models/Productor.model.js';
import Usuario from '../models/Usuario.model.js';
import { generateToken } from '../config/jwt.js';

export const createProducer = async (req, res) => {
  try {
    const { password, ...productorData } = req.body;
    
    const productor = await Productor.create(productorData);
    
    // Si se proporciona password, crear usuario automáticamente
    if (password) {
      try {
        const usuario = await Usuario.create({
          email: productorData.emailContacto,
          password,
          rol: 'productor',
          nombre: productorData.nombreContacto || productorData.razonSocial,
          telefono: productorData.telefonoContacto,
          productorId: productor._id
        });
        
        res.status(201).json({
          message: 'Productor y usuario creados exitosamente',
          producer: productor,
          userCreated: true
        });
      } catch (userError) {
        // Si falla la creación del usuario, eliminar el productor creado
        await Productor.findByIdAndDelete(productor._id);
        throw new Error(`Error al crear usuario: ${userError.message}`);
      }
    } else {
      res.status(201).json({
        message: 'Productor creado exitosamente',
        producer: productor,
        userCreated: false
      });
    }
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
    const productor = await Productor.findByIdAndDelete(req.params.id);

    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    res.json({
      message: 'Productor eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProducerAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;

    const productor = await Productor.findById(id);
    if (!productor) {
      return res.status(404).json({ message: 'Productor no encontrado' });
    }

    const existingUser = await Usuario.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const usuario = await Usuario.create({
      email,
      password,
      rol: 'productor',
      nombre: productor.nombreContacto || productor.razonSocial,
      telefono: productor.telefonoContacto,
      productorId: productor._id
    });

    const token = generateToken(usuario._id, usuario.rol);

    res.status(201).json({
      message: 'Acceso creado exitosamente',
      user: usuario.toJSON(),
      token,
      credentials: {
        email,
        password
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
