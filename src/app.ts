// src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { swaggerSpec, swaggerUi, swaggerUiOptions } from './docs/swagger.js';

import { envManager } from './common/config/environment.js';
import identifyRoutes from './features/identify/identify.routes.js';
import geographicRoutes from './features/geographic/geographic.routes.js';
import catalog3dRoutes from './features/catalog3d/catalog3d.routes.js';
import groupsRoutes from './features/groups/groups.routes.js';
import authRoutes from './features/auth/auth.routes.js';
import adminRoutes from './features/admin/admin.routes.js';
import usersRoutes from './features/users/users.routes.js';

import { errorHandler } from './common/middleware/errorHandler.js';
import { requestLogger } from './common/middleware/requestLogger.js';
import {
  authenticateRequest,
  rateLimiter,
} from './features/auth/auth.middleware.js';
import { ApiError } from './common/errors/apiError.js';
import { db } from './common/config/database.js';
import logger, { LogCategory } from './common/config/logger.js';

import {
  sanitizeInputs,
  sanitizeGeoCoordinates,
} from './common/middleware/inputSanitizer.js';

const app = express();

app.use(helmet(envManager.getHelmetConfig()));
const corsConfig = envManager.getCorsConfig();
app.use(cors(corsConfig));
app.use(cookieParser());
app.use(compression());
app.use(rateLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging e métricas
app.use(requestLogger);

// Sanitização
app.use(sanitizeInputs);
app.use('/api/geographic', sanitizeGeoCoordinates);
app.use('/api/identify', sanitizeGeoCoordinates);

// Rotas de autenticação (não precisam de JWT)
app.use('/api/auth', authRoutes);

// Middleware de autenticação global para todas as outras rotas
app.use(authenticateRequest);

app.use('/api/users', usersRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/identify', identifyRoutes);
app.use('/api/geographic', geographicRoutes);
app.use('/api/catalog3d', catalog3dRoutes);

// Rotas administrativas
app.use('/api/admin', adminRoutes);

// Rota de health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await db.one('SELECT 1'); // Verificar conexão com banco
    res
      .setHeader('Content-Type', 'application/json')
      .setHeader('Cache-Control', 'no-store')
      .json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: envManager.getEnvironment(),
        https: envManager.useHttps(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'connected',
      });
  } catch (err) {
    logger.logError(err instanceof Error ? err : new Error(String(err)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        service: 'health-check',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      },
    });

    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Handler para rotas não encontradas
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.logSecurity('Route not found', {
    endpoint: `${req.method} ${req.originalUrl}`,
    requestId: req.id,
    additionalInfo: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
  });
  next(ApiError.notFound(`Rota não encontrada: ${req.originalUrl}`));
});

app.use(errorHandler);

export default app;
