import { Request, Response } from 'express';
import { ITask } from 'pg-promise';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import {
  CHECK_MODEL_ACCESS,
  LIST_MODEL_PERMISSIONS,
} from './catalog3d.queries.js';
import {
  ModelPermissionInfo,
  UpdateModelPermissionsRequest,
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

export async function listModelPermissions(req: Request, res: Response) {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    throw ApiError.forbidden(
      'Apenas administradores podem visualizar permissões',
    );
  }

  const { modelId } = req.params;

  try {
    const permissions = await db.one<ModelPermissionInfo>(
      LIST_MODEL_PERMISSIONS,
      [modelId],
    );

    logger.logAccess('Listed model permissions', {
      userId: req.user.userId,
      additionalInfo: {
        modelId,
        role: req.user.role,
      },
    });

    return res.json(permissions);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      endpoint: '/catalog3d/permissions',
      userId: req.user.userId,
      additionalInfo: {
        modelId,
      },
    });
    throw ApiError.internal('Erro ao listar permissões do modelo');
  }
}

async function updateUserPermissions(
  t: ITask<any>,
  modelId: string,
  userIds: string[],
) {
  // Deletar permissões existentes
  await t.none('DELETE FROM ng.model_permissions WHERE model_id = $1', [
    modelId,
  ]);

  // Se houver novos IDs, inserir um por um de forma segura
  if (userIds.length > 0) {
    await t.none(
      `INSERT INTO ng.model_permissions (model_id, user_id)
       SELECT $1, unnest($2::uuid[])`,
      [modelId, userIds],
    );
  }
}

async function updateGroupPermissions(
  t: ITask<any>,
  modelId: string,
  groupIds: string[],
) {
  // Deletar permissões existentes
  await t.none('DELETE FROM ng.model_group_permissions WHERE model_id = $1', [
    modelId,
  ]);

  // Se houver novos IDs, inserir um por um de forma segura
  if (groupIds.length > 0) {
    await t.none(
      `INSERT INTO ng.model_group_permissions (model_id, group_id)
       SELECT $1, unnest($2::uuid[])`,
      [modelId, groupIds],
    );
  }
}

export async function updateModelPermissions(req: Request, res: Response) {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
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
        await updateUserPermissions(t, modelId, userIds);
      }

      // Atualizar permissões de grupos se fornecido
      if (groupIds) {
        await updateGroupPermissions(t, modelId, groupIds);
      }
    });

    await createAudit(req, {
      action: 'MODEL_PERMISSION_CHANGE',
      actorId: req.user.userId,
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
      userId: req.user.userId,
      additionalInfo: {
        modelId,
        changes: { access_level, userIds, groupIds },
      },
    });

    return res.json({ message: 'Permissões atualizadas com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      endpoint: '/catalog3d/permissions',
      userId: req.user.userId,
      additionalInfo: {
        modelId,
        attemptedChanges: { access_level, userIds, groupIds },
      },
    });
    throw ApiError.internal('Erro ao atualizar permissões do modelo');
  }
}
