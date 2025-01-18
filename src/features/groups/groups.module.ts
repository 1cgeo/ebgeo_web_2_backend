import { Request, Response } from 'express';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import { CreateGroupDTO, UpdateGroupDTO } from './groups.types.js';
import * as queries from './groups.queries.js';

export async function listGroups(req: Request, res: Response) {
  const { page = 1, limit = 10, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const [groups, total] = await Promise.all([
      db.any(queries.LIST_GROUPS, [search, limit, offset]),
      db.one('SELECT COUNT(*) FROM ng.groups'),
    ]);

    logger.logAccess('Listed groups', {
      userId: req.user?.userId,
      additionalInfo: {
        search,
        page,
        limit,
        groupCount: groups.length,
      },
    });

    return res.json({
      groups,
      total: Number(total.count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ADMIN,
      userId: req.user?.userId,
      additionalInfo: { operation: 'list_groups' },
    });
    throw error;
  }
}

export async function createGroup(
  req: Request<any, any, CreateGroupDTO>,
  res: Response,
) {
  const { name, description, userIds } = req.body;

  try {
    const result = await db.tx(async t => {
      // Verificar se já existe um grupo com o mesmo nome
      const existingGroup = await t.oneOrNone(
        'SELECT id FROM ng.groups WHERE name = $1',
        [name],
      );
      if (existingGroup) {
        throw ApiError.conflict('Já existe um grupo com este nome');
      }

      // Criar o grupo
      const group = await t.one(queries.CREATE_GROUP, [
        name,
        description,
        req.user?.userId,
      ]);

      // Se houver userIds, adicionar os membros
      if (userIds?.length) {
        await t.none(queries.UPDATE_GROUP_MEMBERS, [
          group.id,
          userIds,
          req.user?.userId,
        ]);
      }

      // Retornar grupo completo
      return t.one(queries.GET_GROUP, [group.id]);
    });

    logger.logAccess('Group created', {
      userId: req.user?.userId,
      additionalInfo: {
        groupId: result.id,
        groupName: name,
        memberCount: userIds?.length || 0,
      },
    });

    return res.status(201).json(result);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ADMIN,
      userId: req.user?.userId,
      additionalInfo: {
        operation: 'create_group',
        attemptedName: name,
      },
    });
    throw error;
  }
}

export async function updateGroup(
  req: Request<{ id: string }, any, UpdateGroupDTO>,
  res: Response,
) {
  const { id } = req.params;
  const { name, description, userIds } = req.body;

  try {
    const result = await db.tx(async t => {
      // Verificar se o grupo existe
      const group = await t.oneOrNone('SELECT * FROM ng.groups WHERE id = $1', [
        id,
      ]);
      if (!group) {
        throw ApiError.notFound('Grupo não encontrado');
      }

      // Se mudar o nome, verificar se já existe
      if (name && name !== group.name) {
        const existingGroup = await t.oneOrNone(
          'SELECT id FROM ng.groups WHERE name = $1 AND id != $2',
          [name, id],
        );
        if (existingGroup) {
          throw ApiError.conflict('Já existe um grupo com este nome');
        }
      }

      // Atualizar dados do grupo
      await t.one(queries.UPDATE_GROUP, [name, description, id]);

      // Se forneceu userIds, atualizar membros
      if (userIds !== undefined) {
        await t.none(queries.UPDATE_GROUP_MEMBERS, [
          id,
          userIds || [],
          req.user?.userId,
        ]);
      }

      // Retornar grupo atualizado
      return t.one(queries.GET_GROUP, [id]);
    });

    logger.logAccess('Group updated', {
      userId: req.user?.userId,
      additionalInfo: {
        groupId: id,
        updatedFields: {
          name: name !== undefined,
          description: description !== undefined,
          members: userIds !== undefined,
        },
        memberCount: userIds?.length,
      },
    });

    return res.json(result);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ADMIN,
      userId: req.user?.userId,
      additionalInfo: {
        operation: 'update_group',
        groupId: id,
        attemptedChanges: { name, description, memberCount: userIds?.length },
      },
    });
    throw error;
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

    logger.logAccess('Group deleted', {
      userId: req.user?.userId,
      additionalInfo: {
        groupId: id,
      },
    });

    return res.json({ message: 'Grupo removido com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ADMIN,
      userId: req.user?.userId,
      additionalInfo: {
        operation: 'delete_group',
        groupId: id,
      },
    });
    throw error;
  }
}
