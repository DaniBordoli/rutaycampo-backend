/**
 * Converts raw Mongoose/MongoDB errors into user-friendly messages.
 * Prevents internal model paths and technical details from leaking to the client.
 */
export const sanitizeError = (error) => {
  // Mongoose validation error (e.g. required field missing, enum mismatch)
  if (error.name === 'ValidationError') {
    const fields = Object.values(error.errors).map((e) => e.path);
    return {
      status: 400,
      message: 'Los datos ingresados no son válidos. Por favor revisá los campos e intentá nuevamente.',
      fields
    };
  }

  // Mongoose cast error (invalid ObjectId, wrong type)
  if (error.name === 'CastError') {
    return { status: 400, message: 'El identificador proporcionado no es válido.' };
  }

  // MongoDB duplicate key
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0];
    const friendly = {
      cuit: 'El CUIT ingresado ya está registrado.',
      emailContacto: 'El email ingresado ya está registrado.',
      email: 'El email ingresado ya está registrado.'
    };
    return {
      status: 409,
      message: friendly[field] || 'Ya existe un registro con esos datos.'
    };
  }

  // Generic fallback — never expose error.message to the client in production
  const isProd = process.env.NODE_ENV === 'production';
  return {
    status: 500,
    message: isProd
      ? 'Ocurrió un error inesperado. Por favor intentá nuevamente.'
      : error.message
  };
};
