import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/apiError.js';
import logger from '../config/logger.js';
import { LogCategory } from '../config/logger.js';

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
  // Estruturar log baseado no tipo de erro
  if (err instanceof ApiError) {
    // Log para erros conhecidos da API
    logger.logError(err, {
      category: LogCategory.API,
      endpoint: req.path,
      method: req.method,
      requestId: req.id,
      statusCode: err.statusCode,
      additionalInfo: {
        isOperational: err.isOperational,
        details: err.details,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.userId,
      },
    });

    // Resposta para erros da API
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      details: err.details,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
    return;
  }

  // Log para erros desconhecidos do sistema
  logger.logError(err instanceof Error ? err : new Error(String(err)), {
    category: LogCategory.SYSTEM,
    endpoint: req.path,
    method: req.method,
    requestId: req.id,
    additionalInfo: {
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.userId,
    },
  });

  // Converter para erro interno e enviar resposta
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
