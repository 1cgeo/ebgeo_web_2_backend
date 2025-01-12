import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import {
  CreateGroupBody,
  UpdateGroupParams,
  UpdateGroupBody,
} from './groups.types.js';
import * as queries from './groups.queries.js';

export const getUserGroups = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  try {
    const userGroups = await db.any(queries.GET_USER_GROUPS, [req.user.userId]);

    logger.logAccess('Retrieved user groups', {
      userId: req.user.userId,
      additionalInfo: {
        groupCount: userGroups.length,
      },
    });

    return res.json(userGroups);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user.userId,
      requestId: req.requestId,
    });
    throw ApiError.internal('Erro ao buscar grupos do usuário');
  }
};

export const createGroup = async (
  req: Request<ParamsDictionary, unknown, CreateGroupBody>,
  res: Response,
) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { name, description } = req.body;

  try {
    // Verificar se já existe um grupo com o mesmo nome
    const existingGroup = await db.oneOrNone(
      'SELECT id FROM ng.groups WHERE name = $1',
      [name],
    );

    if (existingGroup) {
      throw ApiError.conflict('Já existe um grupo com este nome');
    }

    const newGroup = await db.one(
      `INSERT INTO ng.groups (
          name, description, created_by
        ) VALUES (
          $1, $2, $3
        ) RETURNING id, name, description, created_at`,
      [name, description, req.user.userId],
    );

    logger.logAccess('New group created', {
      userId: req.user.userId,
      additionalInfo: {
        groupId: newGroup.id,
        groupName: newGroup.name,
      },
    });

    return res.status(201).json(newGroup);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      endpoint: '/groups',
      userId: req.user.userId,
      requestId: req.requestId,
    });
    throw error;
  }
};

export const updateGroup = async (
  req: Request<UpdateGroupParams, unknown, UpdateGroupBody>,
  res: Response,
) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { groupId } = req.params;
  const { name, description } = req.body;

  try {
    // Verificar se o grupo existe
    const group = await db.oneOrNone('SELECT * FROM ng.groups WHERE id = $1', [
      groupId,
    ]);

    if (!group) {
      throw ApiError.notFound('Grupo não encontrado');
    }

    // Se um novo nome for fornecido, verificar se já existe
    if (name && name !== group.name) {
      const existingGroup = await db.oneOrNone(
        'SELECT id FROM ng.groups WHERE name = $1 AND id != $2',
        [name, groupId],
      );

      if (existingGroup) {
        throw ApiError.conflict('Já existe um grupo com este nome');
      }
    }

    let updatedGroup;

    if (name !== undefined && description !== undefined) {
      updatedGroup = await db.one(
        `UPDATE ng.groups 
         SET name = $1, 
             description = $2, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, description, updated_at`,
        [name, description, groupId],
      );
    } else if (name !== undefined) {
      updatedGroup = await db.one(
        `UPDATE ng.groups 
         SET name = $1, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, name, description, updated_at`,
        [name, groupId],
      );
    } else if (description !== undefined) {
      updatedGroup = await db.one(
        `UPDATE ng.groups 
         SET description = $1, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, name, description, updated_at`,
        [description, groupId],
      );
    } else {
      // Se nenhum campo for fornecido, retornar o grupo sem modificações
      updatedGroup = group;
    }

    logger.logAccess('Group updated', {
      userId: req.user.userId,
      additionalInfo: {
        groupId,
        updates: { name, description },
      },
    });

    return res.json(updatedGroup);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      endpoint: '/groups',
      userId: req.user.userId,
      requestId: req.requestId,
      additionalInfo: {
        groupId,
        attemptedUpdates: { name, description },
      },
    });
    throw error;
  }
};

export async function listGroups(req: Request, res: Response) {
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const [groups, total] = await Promise.all([
      db.any(queries.LIST_GROUPS, [limit, offset]),
      db.one('SELECT COUNT(*) FROM ng.groups'),
    ]);

    return res.json({
      groups,
      total: Number(total.count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.error('Error listing groups:', {
      error,
      category: LogCategory.ADMIN,
    });
    throw ApiError.internal('Erro ao listar grupos');
  }
}

export async function getGroupDetails(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const group = await db.one(queries.GET_GROUP_DETAILS, [id]);
    return res.json(group);
  } catch (error) {
    logger.error('Error getting group details:', {
      error,
      category: LogCategory.ADMIN,
    });
    throw ApiError.notFound('Grupo não encontrado');
  }
}

export async function deleteGroup(req: Request, res: Response) {
  const { id } = req.params;

  try {
    await db.tx(async t => {
      // Verificar se grupo existe
      const group = await t.oneOrNone(
        'SELECT id FROM ng.groups WHERE id = $1',
        [id],
      );
      if (!group) {
        throw ApiError.notFound('Grupo não encontrado');
      }

      // Remover todas as permissões e relacionamentos
      await t.batch([
        t.none('DELETE FROM ng.model_group_permissions WHERE group_id = $1', [
          id,
        ]),
        t.none('DELETE FROM ng.zone_group_permissions WHERE group_id = $1', [
          id,
        ]),
        t.none('DELETE FROM ng.user_groups WHERE group_id = $1', [id]),
        t.none('DELETE FROM ng.groups WHERE id = $1', [id]),
      ]);
    });

    return res.json({ message: 'Grupo removido com sucesso' });
  } catch (error) {
    logger.error('Error deleting group:', {
      error,
      category: LogCategory.ADMIN,
    });
    throw error;
  }
}

export async function addGroupMembers(req: Request, res: Response) {
  const { id } = req.params;
  const { userIds } = req.body;

  try {
    // Verificar se grupo existe
    const group = await db.oneOrNone('SELECT id FROM ng.groups WHERE id = $1', [
      id,
    ]);
    if (!group) {
      throw ApiError.notFound('Grupo não encontrado');
    }

    // Adicionar membros
    await db.many(queries.ADD_GROUP_MEMBERS, [id, userIds, req.user?.userId]);

    return res.json({ message: 'Membros adicionados com sucesso' });
  } catch (error) {
    logger.error('Error adding group members:', {
      error,
      category: LogCategory.ADMIN,
    });
    throw error;
  }
}

export async function removeGroupMember(req: Request, res: Response) {
  const { id, userId } = req.params;

  try {
    const result = await db.result(
      'DELETE FROM ng.user_groups WHERE group_id = $1 AND user_id = $2',
      [id, userId],
    );

    if (result.rowCount === 0) {
      throw ApiError.notFound('Usuário não encontrado no grupo');
    }

    return res.json({ message: 'Membro removido com sucesso' });
  } catch (error) {
    logger.error('Error removing group member:', {
      error,
      category: LogCategory.ADMIN,
    });
    throw error;
  }
}
