import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../config/logger.js';
import { LogCategory } from '../config/logger.js';

// Estender a interface Request do Express
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Adiciona ID único para rastreamento da request
  req.id = randomUUID();
  req.startTime = Date.now();

  // Log da request com categoria API
  logger.logRequest(req, {
    category: LogCategory.API,
    userId: req.user?.userId,
    username: req.user?.username,
    endpoint: req.path,
  });

  // Log da response
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    // Log básico da response
    logger.logResponse(res, duration, {
      category: LogCategory.API,
      userId: req.user?.userId,
      username: req.user?.username,
      endpoint: req.path,
    });

    // Log adicional de performance se a requisição for lenta
    if (duration > 1000) {
      // Threshold de 1 segundo
      logger.logPerformance('Slow request detected', {
        duration,
        endpoint: req.path,
        method: req.method,
        userId: req.user?.userId,
        statusCode: res.statusCode,
      });
    }

    // Log de segurança para erros de autorização/autenticação
    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.logSecurity('Authorization failure', {
        statusCode: res.statusCode,
        endpoint: req.path,
        method: req.method,
        userId: req.user?.userId,
        ip: req.ip,
      });
    }

    // Métricas de request
    logger.logMetric('request_duration', duration, {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
    });
  });

  next();
};
