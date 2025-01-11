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

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Adiciona ID único para rastreamento da request
  req.id = randomUUID();
  req.startTime = Date.now();

  // Log da request
  logger.request(req);

  // Log da response
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.response(res, duration);

    // Métricas
    logger.metric('request_duration', duration, {
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode,
    });
  });

  next();
};
