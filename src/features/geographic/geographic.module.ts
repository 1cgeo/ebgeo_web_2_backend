import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
import { GeographicName } from './geographic.types.js';
import { SEARCH_GEOGRAPHIC_NAMES } from './geographic.queries.js';
import { ApiError } from '../../common/errors/apiError.js';

export async function searchGeographicNames(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.unprocessableEntity('Dados de busca inválidos', {
      field: 'searchParams',
      reason: 'Parâmetros de busca inválidos',
      value: errors.array(),
    });
  }

  const { q, lat, lon } = req.query;

  try {
    const searchTerm = q?.toString().trim();
    const centerLat = parseFloat(lat as string);
    const centerLon = parseFloat(lon as string);

    const results = await db.any<GeographicName>(SEARCH_GEOGRAPHIC_NAMES, [
      searchTerm,
      centerLat,
      centerLon,
      req.user?.userId || null,
    ]);

    logger.info('Geographic name search performed', {
      searchTerm,
      coordinates: { lat: centerLat, lon: centerLon },
      resultsCount: results.length,
    });

    return res.json(results);
  } catch (error) {
    logger.error('Error in geographic name search:', { error });
    throw ApiError.internal('Erro ao processar busca de nome geográfico');
  }
}
