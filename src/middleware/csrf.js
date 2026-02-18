const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
  .split(',')
  .map((o) => o.trim());

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const csrfProtection = (req, res, next) => {
  if (!STATE_CHANGING_METHODS.includes(req.method)) {
    return next();
  }

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  const source = origin || (referer ? new URL(referer).origin : null);

  if (!source) {
    return res.status(403).json({ message: 'Solicitud rechazada: origen no especificado' });
  }

  if (!ALLOWED_ORIGINS.includes(source)) {
    return res.status(403).json({ message: 'Solicitud rechazada: origen no permitido' });
  }

  next();
};
