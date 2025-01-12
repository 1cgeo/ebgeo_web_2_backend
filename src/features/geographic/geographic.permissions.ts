import { Request, Response } from 'express';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
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
    logger.error('Error getting zone permissions:', { error, zoneId });
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

    logger.info('Added user permission to zone', {
      zoneId,
      userId,
      addedBy: req.user.userId,
    });

    return res
      .status(201)
      .json({ message: 'Permissão adicionada com sucesso' });
  } catch (error) {
    logger.error('Error adding user permission:', { error, zoneId, userId });
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

    logger.info('Removed user permission from zone', {
      zoneId,
      userId,
      removedBy: req.user.userId,
    });

    return res.json({ message: 'Permissão removida com sucesso' });
  } catch (error) {
    logger.error('Error removing user permission:', { error, zoneId, userId });
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

    logger.info('Added group permission to zone', {
      zoneId,
      groupId,
      addedBy: req.user.userId,
    });

    return res
      .status(201)
      .json({ message: 'Permissão de grupo adicionada com sucesso' });
  } catch (error) {
    logger.error('Error adding group permission:', { error, zoneId, groupId });
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

    logger.info('Updated zone permissions', {
      zoneId,
      updatedBy: req.user.userId,
      userCount: userIds?.length || 0,
      groupCount: groupIds?.length || 0,
    });

    return res.json({ message: 'Permissões atualizadas com sucesso' });
  } catch (error) {
    logger.error('Error updating zone permissions:', { error, zoneId });
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

    logger.info('Removed group permission from zone', {
      zoneId,
      groupId,
      removedBy: req.user.userId,
    });

    return res.json({ message: 'Permissão de grupo removida com sucesso' });
  } catch (error) {
    logger.error('Error removing group permission:', {
      error,
      zoneId,
      groupId,
    });
    throw error;
  }
};
