import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
import { Building } from './building.types.js';
import { FIND_NEAREST_BUILDING } from './building.queries.js';
import { ApiError } from '../../common/errors/apiError.js';

export async function findNearestBuilding(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Parâmetros inválidos', {
      field: 'validation',
      reason: 'Parâmetros inválidos',
      value: errors.array(),
    });
  }

  const { lat, lon, z } = req.query;

  try {
    const result = await db.oneOrNone<Building>(FIND_NEAREST_BUILDING, [
      lon,
      lat,
      z,
    ]);

    logger.info('Building search performed', {
      coordinates: { lat, lon, z },
      found: !!result,
    });

    if (!result) {
      return res.json({
        message:
          'Nenhuma edificação encontrada para as coordenadas fornecidas.',
      });
    }

    return res.json(result);
  } catch (error) {
    logger.error('Error in building search:', { error });
    throw ApiError.internal('Erro ao processar busca de edificação');
  }
}
