import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
import { Catalog3D, SearchResult } from './catalog3d.types.js';
import { COUNT_CATALOG, SEARCH_CATALOG } from './catalog3d.queries.js';
import { ApiError } from '../../common/errors/apiError.js';

export async function searchCatalog3D(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.unprocessableEntity('Parâmetros de busca inválidos', {
      field: 'searchParams',
      reason: 'Validação falhou',
      value: errors.array(),
    });
  }

  const { q, page = 1, nr_records = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(nr_records);

  try {
    const [totalCount, data] = await Promise.all([
      db.one<{ count: string }>(COUNT_CATALOG, [q]),
      db.any<Catalog3D>(SEARCH_CATALOG, [q, nr_records, offset]),
    ]);

    const result: SearchResult = {
      total: parseInt(totalCount.count),
      page: Number(page),
      nr_records: Number(nr_records),
      data,
    };

    logger.info('Catalog3D search performed', {
      query: q,
      page,
      nr_records,
      resultsCount: data.length,
    });

    return res.json(result);
  } catch (error) {
    logger.error('Error in catalog3d search:', { error });
    throw ApiError.internal('Erro ao processar busca no catálogo 3D');
  }
}
