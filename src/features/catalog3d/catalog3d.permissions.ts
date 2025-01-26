import { Request, Response } from 'express';
import { ITask } from 'pg-promise';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import {
  CHECK_MODEL_ACCESS,
  LIST_MODEL_PERMISSIONS,
  COUNT_MODEL_PERMISSIONS,
} from './catalog3d.queries.js';
import {
  UpdateModelPermissionsRequest,
  ModelPermissionsQueryParams,
} from './catalog3d.types.js';
import { UserRole } from '../auth/auth.types.js';
import { createAudit } from '../../common/config/audit.js';

export async function checkModelAccess(
  modelId: string,
  userId?: string,
): Promise<boolean> {
  const result = await db.one<{ has_access: boolean }>(CHECK_MODEL_ACCESS, [
    modelId,
    userId,
  ]);
  return result.has_access;
}

export async function listModelPermissions(
  req: Request<any, any, any, ModelPermissionsQueryParams>,
  res: Response,
) {
  const {
    page = 1,
    limit = 10,
    search,
    sort = 'name',
    order = 'asc',
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const searchTerm = search === undefined ? null : search;

  try {
    const validatedSortDirection = order.toUpperCase();

    const [models, total] = await Promise.all([
      db.any(LIST_MODEL_PERMISSIONS, [
        searchTerm,
        limit,
        offset,
        sort,
        validatedSortDirection,
      ]),
      db.one(COUNT_MODEL_PERMISSIONS, [searchTerm]),
    ]);

    logger.logAccess('Listed model permissions', {
      userId: req.user?.userId,
      additionalInfo: {
        search,
        page,
        limit,
        sort,
        order,
        modelCount: models.length,
      },
    });

    return res.json({
      models,
      total: Number(total.count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user?.userId,
      additionalInfo: { operation: 'list_model_permissions' },
    });
    throw error;
  }
}

async function updateUserPermissions(
  t: ITask<any>,
  modelId: string,
  userIds: string[],
  createdBy: string,
) {
  // Validar existência dos usuários primeiro
  const validUsers = await t.manyOrNone(
    'SELECT id FROM ng.users WHERE id::text = ANY($1::text[]) AND is_active = true',
    [userIds],
  );

  const foundIds = validUsers.map(u => u.id);
  const invalidIds = userIds.filter(id => !foundIds.includes(id));

  if (invalidIds.length > 0) {
    throw ApiError.unprocessableEntity('Usuários não encontrados', {
      invalidIds,
    });
  }

  await t.none('DELETE FROM ng.model_permissions WHERE model_id = $1', [
    modelId,
  ]);

  if (userIds.length > 0) {
    await t.none(
      `INSERT INTO ng.model_permissions (model_id, user_id, created_by, created_at)
      SELECT $1, id::uuid, $3, CURRENT_TIMESTAMP
      FROM ng.users 
      WHERE id::text = ANY($2::text[])`,
      [modelId, userIds, createdBy],
    );
  }
}

async function updateGroupPermissions(
  t: ITask<any>,
  modelId: string,
  groupIds: string[],
  createdBy: string,
) {
  // Validar existência dos grupos primeiro
  const validGroups = await t.manyOrNone(
    'SELECT id FROM ng.groups WHERE id::text = ANY($1::text[])',
    [groupIds],
  );

  const foundIds = validGroups.map(g => g.id);
  const invalidIds = groupIds.filter(id => !foundIds.includes(id));

  if (invalidIds.length > 0) {
    throw ApiError.unprocessableEntity('Grupos não encontrados', {
      invalidIds,
    });
  }

  await t.none('DELETE FROM ng.model_group_permissions WHERE model_id = $1', [
    modelId,
  ]);

  if (groupIds.length > 0) {
    await t.none(
      `INSERT INTO ng.model_group_permissions (model_id, group_id, created_by, created_at)
      SELECT $1, id::uuid, $3, CURRENT_TIMESTAMP  
      FROM ng.groups
      WHERE id::text = ANY($2::text[])`,
      [modelId, groupIds, createdBy],
    );
  }
}

export async function updateModelPermissions(req: Request, res: Response) {
  const user = req.user;
  if (!user || user.role !== UserRole.ADMIN) {
    throw ApiError.forbidden(
      'Apenas administradores podem atualizar permissões',
    );
  }

  const { modelId } = req.params;
  const { access_level, userIds, groupIds } =
    req.body as UpdateModelPermissionsRequest;

  try {
    const currentModel = await db.one(LIST_MODEL_PERMISSIONS, [modelId]);

    await db.tx(async t => {
      // Atualizar nível de acesso
      if (access_level) {
        await t.none(
          'UPDATE ng.catalogo_3d SET access_level = $1 WHERE id = $2',
          [access_level, modelId],
        );
      }

      // Atualizar permissões de usuários se fornecido
      if (userIds) {
        await updateUserPermissions(t, modelId, userIds, user.userId);
      }

      // Atualizar permissões de grupos se fornecido
      if (groupIds) {
        await updateGroupPermissions(t, modelId, groupIds, user.userId);
      }
    });

    await createAudit(req, {
      action: 'MODEL_PERMISSION_CHANGE',
      actorId: user.userId,
      targetType: 'MODEL',
      targetId: modelId,
      targetName: currentModel.model_name,
      details: {
        changes: {
          access_level: access_level || undefined,
          userPermissions: userIds?.length || 0,
          groupPermissions: groupIds?.length || 0,
          previous: {
            access_level: currentModel.access_level,
            userPermissions: currentModel.user_permissions.length,
            groupPermissions: currentModel.group_permissions.length,
          },
        },
      },
    });

    logger.logSecurity('Model permissions updated', {
      userId: user.userId,
      additionalInfo: {
        modelId,
        changes: { access_level, userIds, groupIds },
      },
    });

    return res.json({ message: 'Permissões atualizadas com sucesso' });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      endpoint: '/catalog3d/permissions',
      userId: user.userId,
      additionalInfo: {
        modelId,
        attemptedChanges: { access_level, userIds, groupIds },
      },
    });
    throw ApiError.internal('Erro ao atualizar permissões do modelo');
  }
}
