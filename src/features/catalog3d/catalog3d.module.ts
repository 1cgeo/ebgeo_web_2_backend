import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { Catalog3D, SearchResult } from './catalog3d.types.js';
import { COUNT_CATALOG, SEARCH_CATALOG } from './catalog3d.queries.js';
import { ApiError } from '../../common/errors/apiError.js';
import { sendJsonResponse } from '../../common/helpers/response.js';

export async function searchCatalog3D(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.unprocessableEntity('Parâmetros de busca inválidos', {
      errors: errors.array(),
    });
  }

  const { q, page = 1, nr_records = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(nr_records);
  const userId = req.user?.userId || null;

  try {
    const [totalCount, data] = await Promise.all([
      db.one<{ count: string }>(COUNT_CATALOG, [q, userId]),
      db.any<Catalog3D>(SEARCH_CATALOG, [q, nr_records, offset, userId]),
    ]);

    const result: SearchResult = {
      total: parseInt(totalCount.count),
      page: Number(page),
      nr_records: Number(nr_records),
      data,
    };

    return sendJsonResponse(res, result);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      endpoint: '/catalog3d/catalogo3d',
      requestId: req.id,
      additionalInfo: {
        query: q,
        pagination: { page, nr_records },
      },
    });
    throw ApiError.internal('Erro ao processar busca no catálogo 3D');
  }
}
