import Usuario from '../models/Usuario.model.js';
import Productor from '../models/Productor.model.js';
import Transportista from '../models/Transportista.model.js';
import { generateToken } from '../config/jwt.js';

export const register = async (req, res) => {
  try {
    const { email, password, role, name, phone, producerData, transportistaData } = req.body;

    const existingUser = await Usuario.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    let productorId = null;
    let transportistaId = null;

    if (role === 'productor' && producerData) {
      const productor = await Productor.create(producerData);
      productorId = productor._id;
    }

    if (role === 'transportista' && transportistaData) {
      const transportista = await Transportista.create(transportistaData);
      transportistaId = transportista._id;
    }

    const usuario = await Usuario.create({
      email,
      password,
      rol: role,
      nombre: name,
      telefono: phone,
      productorId,
      transportistaId
    });

    const token = generateToken(usuario._id, usuario.rol);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: usuario.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ email });
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isMatch = await usuario.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = generateToken(usuario._id, usuario.rol);

    res.json({
      message: 'Login exitoso',
      token,
      user: usuario.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id)
      .populate('productorId')
      .populate('transportistaId');

    res.json({ user: usuario.toJSON() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
