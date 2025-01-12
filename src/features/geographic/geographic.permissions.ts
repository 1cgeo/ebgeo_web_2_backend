import { Request, Response } from 'express';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import {
  ZonePermissions,
  UpdateZonePermissionsRequest,
} from './geographic.types.js';

import { GET_ZONE_PERMISSIONS } from './geographic.queries.js';

// Listar permissões de uma zona
export const getZonePermissions = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { zoneId } = req.params;

  try {
    const permissions = await db.one<ZonePermissions>(GET_ZONE_PERMISSIONS, [
      zoneId,
    ]);
    return res.json(permissions);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ACCESS,
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'zone_permissions_retrieval',
        zoneId,
      },
    });
    throw error;
  }
};

// Adicionar permissão de usuário
export const addUserPermission = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { zoneId } = req.params;
  const { userId } = req.body;

  try {
    await db.none(
      'INSERT INTO ng.zone_permissions (zone_id, user_id, created_by) VALUES ($1, $2, $3)',
      [zoneId, userId, req.user.userId],
    );

    logger.logSecurity('User permission added to zone', {
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'add_user_permission',
        zoneId,
        targetUserId: userId,
      },
    });

    return res
      .status(201)
      .json({ message: 'Permissão adicionada com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'add_user_permission',
        zoneId,
        targetUserId: userId,
      },
    });
    throw error;
  }
};

// Remover permissão de usuário
export const removeUserPermission = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { zoneId, userId } = req.params;

  try {
    await db.none(
      'DELETE FROM ng.zone_permissions WHERE zone_id = $1 AND user_id = $2',
      [zoneId, userId],
    );

    logger.logSecurity('User permission removed from zone', {
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'remove_user_permission',
        zoneId,
        targetUserId: userId,
      },
    });

    return res.json({ message: 'Permissão removida com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'remove_user_permission',
        zoneId,
        targetUserId: userId,
      },
    });
    throw error;
  }
};

// Adicionar permissão de grupo
export const addGroupPermission = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { zoneId } = req.params;
  const { groupId } = req.body;

  try {
    await db.none(
      'INSERT INTO ng.zone_group_permissions (zone_id, group_id, created_by) VALUES ($1, $2, $3)',
      [zoneId, groupId, req.user.userId],
    );

    logger.logSecurity('Group permission added to zone', {
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'add_group_permission',
        zoneId,
        groupId,
      },
    });

    return res
      .status(201)
      .json({ message: 'Permissão de grupo adicionada com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'add_group_permission',
        zoneId,
        groupId,
      },
    });
    throw error;
  }
};

// Remover permissão de grupo
// Atualizar todas as permissões de uma zona
export const updateZonePermissions = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { zoneId } = req.params;
  const { userIds, groupIds } = req.body as UpdateZonePermissionsRequest;

  try {
    await db.tx(async t => {
      // Atualizar permissões de usuários
      await t.none('DELETE FROM ng.zone_permissions WHERE zone_id = $1', [
        zoneId,
      ]);
      if (userIds && userIds.length > 0) {
        const userValues = userIds.map(userId => ({
          zone_id: zoneId,
          user_id: userId,
          created_by: req.user?.userId,
        }));
        await t.none(
          'INSERT INTO ng.zone_permissions (zone_id, user_id, created_by) VALUES ${values:csv}',
          { values: userValues },
        );
      }

      // Atualizar permissões de grupos
      await t.none('DELETE FROM ng.zone_group_permissions WHERE zone_id = $1', [
        zoneId,
      ]);
      if (groupIds && groupIds.length > 0) {
        const groupValues = groupIds.map(groupId => ({
          zone_id: zoneId,
          group_id: groupId,
          created_by: req.user?.userId,
        }));
        await t.none(
          'INSERT INTO ng.zone_group_permissions (zone_id, group_id, created_by) VALUES ${values:csv}',
          { values: groupValues },
        );
      }
    });

    logger.logSecurity('Zone permissions updated', {
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'update_zone_permissions',
        zoneId,
        changes: {
          userCount: userIds?.length || 0,
          groupCount: groupIds?.length || 0,
        },
      },
    });

    return res.json({ message: 'Permissões atualizadas com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'update_zone_permissions',
        zoneId,
        attemptedChanges: {
          userIds,
          groupIds,
        },
      },
    });
    throw error;
  }
};

export const removeGroupPermission = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { zoneId, groupId } = req.params;

  try {
    await db.none(
      'DELETE FROM ng.zone_group_permissions WHERE zone_id = $1 AND group_id = $2',
      [zoneId, groupId],
    );

    logger.logSecurity('Group permission removed from zone', {
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'remove_group_permission',
        zoneId,
        groupId,
      },
    });

    return res.json({ message: 'Permissão de grupo removida com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      userId: req.user.userId,
      requestId: req.id,
      additionalInfo: {
        operation: 'remove_group_permission',
        zoneId,
        groupId,
      },
    });
    throw error;
  }
};
