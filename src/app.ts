import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import 'dotenv/config';

import buildingRoutes from './features/buildings/building.routes.js';
import geographicRoutes from './features/geographic/geographic.routes.js';
import catalog3dRoutes from './features/catalog3d/catalog3d.routes.js';

import { errorHandler } from './common/middleware/errorHandler.js';
import { requestLogger } from './common/middleware/requestLogger.js';
import { ApiError } from './common/errors/apiError.js';

import {
  sanitizeInputs,
  sanitizeGeoCoordinates,
} from './common/middleware/inputSanitizer.js';

const app = express();

// Middlewares de segurança
app.use(helmet());
app.use(cors());

// Compressão
app.use(compression());

// Parsing com limites
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(requestLogger as express.RequestHandler);

app.use(sanitizeInputs);
app.use('/api/geographic', sanitizeGeoCoordinates);
app.use('/api/buildings', sanitizeGeoCoordinates);

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
