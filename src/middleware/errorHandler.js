import { sanitizeError } from '../utils/sanitizeError.js';

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  const { status, message } = sanitizeError(err);
  res.status(status).json({ message });
};
