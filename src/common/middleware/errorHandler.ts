import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/apiError.js';
import logger from '../config/logger.js';

interface ExtendedError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  details?: unknown;
}

export const errorHandler = (
  err: ExtendedError | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Log estruturado do erro
  const errorLog = {
    message: 'Error occurred',
    name: err.constructor.name,
    errorMessage: err.message,
    path: req.path,
    method: req.method,
    query: req.query,
    ip: req.ip,
    stack: err.stack,
  };

  if (err instanceof ApiError) {
    Object.assign(errorLog, {
      statusCode: err.statusCode,
      isOperational: err.isOperational,
      details: err.details,
    });
  }

  logger.error(errorLog);

  // Se for um ApiError, usa suas propriedades
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      details: err.details,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
    return;
  }

  // Erro desconhecido - converte para ApiError interno
  const internalError = ApiError.internal(
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  );

  res.status(500).json({
    status: 'error',
    message: internalError.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
