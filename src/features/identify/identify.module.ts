import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { Feature } from './identify.types.js';
import { FIND_NEAREST_FEATURE } from './identify.queries.js';
import { ApiError } from '../../common/errors/apiError.js';
import { validateSpatialPoint } from './identify.validation.js';
import { sendJsonResponse } from '../../common/helpers/response.js';

export async function findNearestFeature(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Parâmetros inválidos', {
      field: 'validation',
      reason: 'Parâmetros inválidos',
      value: errors.array(),
    });
  }

  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const z = parseFloat(req.query.z as string);
  const userId = req.user?.userId;

  if (!validateSpatialPoint(lat, lon, z)) {
    throw ApiError.badRequest('Coordenadas espaciais inválidas');
  }

  try {
    const result = await db.oneOrNone<Feature>(FIND_NEAREST_FEATURE, [
      lon,
      lat,
      z,
      userId,
    ]);

    logger.logAccess('Feature search performed', {
      userId,
      additionalInfo: {
        coordinates: { lat, lon, z },
        found: !!result,
        featureId: result?.id,
        modelId: result?.model_id,
      },
    });

    if (!result) {
      return sendJsonResponse(res, {
        message: 'Nenhuma feição encontrada para as coordenadas fornecidas.',
      });
    }

    result.z_distance = Number(result.z_distance);
    result.xy_distance = Number(result.xy_distance);
    result.altitude_base = Number(result.altitude_base);
    result.altitude_topo = Number(result.altitude_topo);

    return sendJsonResponse(res, result);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      endpoint: '/feicoes',
      additionalInfo: {
        coordinates: { lat, lon, z },
      },
    });
    throw ApiError.internal('Erro ao processar identificação de feição');
  }
}
