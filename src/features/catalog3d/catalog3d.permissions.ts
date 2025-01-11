import { Request, Response } from 'express';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
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

    logger.info('Listed model permissions', {
      modelId,
      adminId: req.user.userId,
    });

    return res.json(permissions);
  } catch (error) {
    logger.error('Error listing model permissions:', { error, modelId });
    throw ApiError.internal('Erro ao listar permissões do modelo');
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
    await db.tx(async t => {
      // Atualizar nível de acesso
      if (access_level) {
        await t.none(
          'UPDATE ng.catalogo_3d SET access_level = $1 WHERE id = $2',
          [access_level, modelId],
        );
      }

      // Atualizar permissões de usuários
      if (userIds) {
        await t.none('DELETE FROM ng.model_permissions WHERE model_id = $1', [
          modelId,
        ]);
        if (userIds.length > 0) {
          const values = userIds
            .map((userId: string) => `(${modelId}, ${userId})`)
            .join(',');
          await t.none(`
            INSERT INTO ng.model_permissions (model_id, user_id)
            VALUES ${values}
          `);
        }
      }

      // Atualizar permissões de grupos
      if (groupIds) {
        await t.none(
          'DELETE FROM ng.model_group_permissions WHERE model_id = $1',
          [modelId],
        );
        if (groupIds.length > 0) {
          const values = groupIds
            .map((groupId: string) => `(${modelId}, ${groupId})`)
            .join(',');
          await t.none(`
            INSERT INTO ng.model_group_permissions (model_id, group_id)
            VALUES ${values}
          `);
        }
      }
    });

    logger.info('Updated model permissions', {
      modelId,
      adminId: req.user.userId,
      changes: { access_level, userIds, groupIds },
    });

    return res.json({ message: 'Permissões atualizadas com sucesso' });
  } catch (error) {
    logger.error('Error updating model permissions:', { error, modelId });
    throw ApiError.internal('Erro ao atualizar permissões do modelo');
  }
}
