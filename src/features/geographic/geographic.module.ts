import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import {
  GeographicName,
  CreateZoneRequest,
  UpdateZonePermissionsRequest,
} from './geographic.types.js';
import * as queries from './geographic.queries.js';
import { createAudit } from '../../common/config/audit.js';

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

    const results = await db.any<GeographicName>(
      queries.SEARCH_GEOGRAPHIC_NAMES,
      [searchTerm, centerLat, centerLon, req.user?.userId || null],
    );

    logger.logAccess('Geographic name search performed', {
      requestId: req.id,
      additionalInfo: {
        searchTerm,
        coordinates: { lat: centerLat, lon: centerLon },
        resultsCount: results.length,
      },
    });

    return res.json(results);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      endpoint: '/geographic/busca',
      requestId: req.id,
      additionalInfo: {
        searchTerm: q?.toString().trim(),
        coordinates: { lat, lon },
      },
    });
    throw ApiError.internal('Erro ao processar busca de nome geográfico');
  }
}

export async function listZones(req: Request, res: Response) {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  try {
    const zones = await db.any(queries.LIST_ZONES);

    logger.logAccess('Zones listed', {
      userId: req.user.userId,
      additionalInfo: {
        zonesCount: zones.length,
      },
    });

    return res.json(zones);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user.userId,
      endpoint: '/geographic/zones',
    });
    throw ApiError.internal('Erro ao listar zonas geográficas');
  }
}

export async function getZonePermissions(req: Request, res: Response) {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { zoneId } = req.params;

  try {
    const exists = await db.one(queries.CHECK_ZONE_EXISTS, [zoneId]);
    if (!exists.exists) {
      throw ApiError.notFound('Zona não encontrada');
    }

    const permissions = await db.one(queries.GET_ZONE_PERMISSIONS, [zoneId]);

    logger.logAccess('Zone permissions retrieved', {
      userId: req.user.userId,
      additionalInfo: {
        zoneId,
      },
    });

    return res.json(permissions);
  } catch (error) {
    if (error instanceof ApiError) throw error;

    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user.userId,
      endpoint: '/geographic/zones/permissions',
      additionalInfo: { zoneId },
    });
    throw ApiError.internal('Erro ao recuperar permissões da zona');
  }
}

export async function createZone(req: Request, res: Response) {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.unprocessableEntity('Dados inválidos', {
      field: 'zoneData',
      value: errors.array(),
    });
  }

  const { name, description, geom, userIds, groupIds } =
    req.body as CreateZoneRequest;

  try {
    const result = await db.tx(async t => {
      // Criar a zona
      const zone = await t.one(queries.CREATE_ZONE, [
        name,
        description,
        JSON.stringify(geom),
        req.user?.userId,
      ]);

      // Adicionar permissões de usuários se fornecidas
      if (userIds?.length) {
        await t.none(queries.INSERT_USER_PERMISSIONS, [
          zone.id,
          userIds,
          req.user?.userId,
        ]);
      }

      // Adicionar permissões de grupos se fornecidas
      if (groupIds?.length) {
        await t.none(queries.INSERT_GROUP_PERMISSIONS, [
          zone.id,
          groupIds,
          req.user?.userId,
        ]);
      }

      return zone;
    });

    await createAudit(req, {
      action: 'ZONE_CREATE',
      actorId: req.user.userId,
      targetType: 'ZONE',
      targetId: result.id,
      targetName: name,
      details: {
        description,
        geom,
        userPermissions: userIds?.length || 0,
        groupPermissions: groupIds?.length || 0,
      },
    });

    logger.logAccess('Zone created', {
      userId: req.user.userId,
      additionalInfo: {
        zoneId: result.id,
        zoneName: name,
        userPermissions: userIds?.length || 0,
        groupPermissions: groupIds?.length || 0,
      },
    });

    return res.status(201).json(result);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user.userId,
      endpoint: '/geographic/zones',
      additionalInfo: {
        zoneName: name,
      },
    });
    throw ApiError.internal('Erro ao criar zona geográfica');
  }
}

export async function updateZonePermissions(req: Request, res: Response) {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.unprocessableEntity('Dados inválidos', {
      field: 'permissions',
      value: errors.array(),
    });
  }

  const { zoneId } = req.params;
  const { userIds, groupIds } = req.body as UpdateZonePermissionsRequest;

  try {
    const exists = await db.one(queries.CHECK_ZONE_EXISTS, [zoneId]);
    if (!exists.exists) {
      throw ApiError.notFound('Zona não encontrada');
    }

    await db.tx(async t => {
      // Remover todas as permissões existentes
      await t.none('DELETE FROM ng.zone_permissions WHERE zone_id = $1', [
        zoneId,
      ]);
      await t.none('DELETE FROM ng.zone_group_permissions WHERE zone_id = $1', [
        zoneId,
      ]);

      // Adicionar novas permissões de usuários
      if (userIds?.length) {
        await t.none(queries.INSERT_USER_PERMISSIONS, [
          zoneId,
          userIds,
          req.user?.userId,
        ]);
      }

      // Adicionar novas permissões de grupos
      if (groupIds?.length) {
        await t.none(queries.INSERT_GROUP_PERMISSIONS, [
          zoneId,
          groupIds,
          req.user?.userId,
        ]);
      }
    });

    await createAudit(req, {
      action: 'ZONE_PERMISSION_CHANGE',
      actorId: req.user.userId,
      targetType: 'ZONE',
      targetId: zoneId,
      targetName: exists.name,
      details: {
        userPermissions: userIds?.length || 0,
        groupPermissions: groupIds?.length || 0,
      },
    });

    logger.logAccess('Zone permissions updated', {
      userId: req.user.userId,
      additionalInfo: {
        zoneId,
        userPermissions: userIds?.length || 0,
        groupPermissions: groupIds?.length || 0,
      },
    });

    return res.json({ message: 'Permissões atualizadas com sucesso' });
  } catch (error) {
    if (error instanceof ApiError) throw error;

    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user.userId,
      endpoint: '/geographic/zones/permissions',
      additionalInfo: { zoneId },
    });
    throw ApiError.internal('Erro ao atualizar permissões da zona');
  }
}

export async function deleteZone(req: Request, res: Response) {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { zoneId } = req.params;

  try {
    const exists = await db.one(queries.CHECK_ZONE_EXISTS, [zoneId]);
    if (!exists.exists) {
      throw ApiError.notFound('Zona não encontrada');
    }

    await createAudit(req, {
      action: 'ZONE_DELETE',
      actorId: req.user.userId,
      targetType: 'ZONE',
      targetId: zoneId,
      targetName: exists.name,
      details: {
        removedZone: exists,
      },
    });

    await db.one(queries.DELETE_ZONE, [zoneId]);

    logger.logAccess('Zone deleted', {
      userId: req.user.userId,
      additionalInfo: {
        zoneId,
      },
    });

    return res.json({ message: 'Zona removida com sucesso' });
  } catch (error) {
    if (error instanceof ApiError) throw error;

    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user.userId,
      endpoint: '/geographic/zones',
      additionalInfo: { zoneId },
    });
    throw ApiError.internal('Erro ao remover zona');
  }
}
