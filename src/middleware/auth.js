import { verifyToken } from '../config/jwt.js';
import Usuario from '../models/Usuario.model.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: 'No se proporcionó token de autenticación' });
    }

    const decoded = verifyToken(token);
    const usuario = await Usuario.findById(decoded.id).select('-password');

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }

    req.user = usuario;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    const allowedRoles = roles.flat();
    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ 
        message: 'No tienes permisos para realizar esta acción' 
      });
    }
    next();
  };
};
