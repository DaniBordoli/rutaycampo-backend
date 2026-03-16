import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isDev ? 5000 : 200),
  message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev && !process.env.RATE_LIMIT_MAX_REQUESTS,
});
