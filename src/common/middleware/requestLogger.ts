import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../config/logger.js';

// Estender a interface Request do Express
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

// Lista de padrões de URL para ignorar no logging
const IGNORED_PATHS = [
  /\.(ico|png|jpg|jpeg|gif|svg|css|js|map)$/i,
  /^\/favicon/,
  /^\/static/,
  /^\/assets/,
  /^\/_next/,
  /^\/api-docs.*\.(png|ico)$/,
];

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (IGNORED_PATHS.some(pattern => pattern.test(req.path))) {
    return next();
  }

  // Adiciona ID único para rastreamento da request
  req.id = randomUUID();
  req.startTime = Date.now();

  // Log da response
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    // Log de performance se a requisição for lenta
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
  });

  next();
};
