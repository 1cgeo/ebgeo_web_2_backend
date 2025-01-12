// src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import { envManager } from './common/config/environment.js';
import identifyRoutes from './features/identify/identify.routes.js';
import geographicRoutes from './features/geographic/geographic.routes.js';
import catalog3dRoutes from './features/catalog3d/catalog3d.routes.js';
import groupsRoutes from './features/groups/groups.routes.js';
import authRoutes from './features/auth/auth.routes.js';

import { errorHandler } from './common/middleware/errorHandler.js';
import { requestLogger } from './common/middleware/requestLogger.js';
import {
  authenticateRequest,
  rateLimiter,
  csrfProtection,
} from './features/auth/auth.middleware.js';
import { ApiError } from './common/errors/apiError.js';
import { db } from './common/config/database.js';
import logger from './common/config/logger.js';

import {
  sanitizeInputs,
  sanitizeGeoCoordinates,
} from './common/middleware/inputSanitizer.js';

const app = express();

app.use(helmet(envManager.getHelmetConfig()));

const corsConfig = envManager.getCorsConfig();
app.use(cors(corsConfig));

// Parsing de cookies
app.use(cookieParser());

// Compressão
app.use(compression());

// Rate limiting global
app.use(rateLimiter);

// Parsing com limites
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(csrfProtection);

// Logging
app.use(requestLogger);

// Sanitização global
app.use(sanitizeInputs);

// Sanitização específica para coordenadas
app.use('/api/geographic', sanitizeGeoCoordinates);
app.use('/api/identify', sanitizeGeoCoordinates);

// Rotas de autenticação (não precisam de JWT)
app.use('/api/auth', authRoutes);

// Middleware de autenticação global para todas as outras rotas
app.use(authenticateRequest);

app.use('/api/groups', groupsRoutes);
app.use('/api/identify', identifyRoutes);
app.use('/api/geographic', geographicRoutes);
app.use('/api/catalog3d', catalog3dRoutes);

// Rota de health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await db.one('SELECT 1'); // Verificar conexão com banco
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: envManager.getEnvironment(),
      https: envManager.useHttps(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected',
    });
  } catch (err) {
    logger.error('Health check failed:', {
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });

    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// Handler para rotas não encontradas
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.warn(`Rota não encontrada: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
  });
  next(ApiError.notFound(`Rota não encontrada: ${req.originalUrl}`));
});

// Error handling
app.use(errorHandler);

export default app;
