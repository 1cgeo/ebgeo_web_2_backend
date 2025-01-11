import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import buildingRoutes from './features/buildings/building.routes.js';
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

import {
  sanitizeInputs,
  sanitizeGeoCoordinates,
} from './common/middleware/inputSanitizer.js';

const app = express();

// Configuração de CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true, // Necessário para cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-CSRF-Token',
  ],
};

// Middlewares de segurança
app.use(helmet());
app.use(cors(corsOptions));

// Parsing de cookies
app.use(cookieParser());

// Compressão
app.use(compression());

// Rate limiting global
app.use(rateLimiter);

app.use(csrfProtection);

// Parsing com limites
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(requestLogger);

// Sanitização global
app.use(sanitizeInputs);

// Sanitização específica para coordenadas
app.use('/api/geographic', sanitizeGeoCoordinates);
app.use('/api/buildings', sanitizeGeoCoordinates);

// Rotas de autenticação (não precisam de JWT)
app.use('/api/auth', authRoutes);

// Middleware de autenticação global para todas as outras rotas
app.use(authenticateRequest);

app.use('/api/groups', groupsRoutes);

// Rotas das features com prefixos apropriados
app.use('/api/buildings', buildingRoutes);
app.use('/api/geographic', geographicRoutes);
app.use('/api/catalog3d', catalog3dRoutes);

// Rota de health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Handler para rotas não encontradas
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Rota não encontrada: ${req.originalUrl}`));
});

// Error handling
app.use(errorHandler);

export default app;
