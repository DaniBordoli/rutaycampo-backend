export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Error de validación',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      message: 'ID inválido'
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      message: 'Ya existe un registro con esos datos'
    });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor'
  });
};
