import { Request, Response } from 'express';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import { CreateGroupDTO, UpdateGroupDTO } from './groups.types.js';
import * as queries from './groups.queries.js';
import { createAudit } from '../../common/config/audit.js';
import { sendJsonResponse } from '../../common/helpers/response.js';

export async function listGroups(req: Request, res: Response) {
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
    const validatedSortDirection = order === 'asc' ? 'ASC' : 'DESC';

    const [groups, total] = await Promise.all([
      db.any(queries.LIST_GROUPS, [
        searchTerm,
        limit,
        offset,
        sort,
        validatedSortDirection,
      ]),
      db.one(queries.COUNT_GROUPS, [searchTerm]),
    ]);

    logger.logAccess('Listed groups', {
      userId: req.user?.userId,
      additionalInfo: {
        search,
        page,
        limit,
        sort,
        order,
        groupCount: groups.length,
      },
    });

    return sendJsonResponse(res, {
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
      if (!req.user?.userId) {
        throw ApiError.unauthorized('Usuário não autenticado');
      }
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

      const fullGroup = await t.one(queries.GET_GROUP, [group.id]);

      // Adicionar auditoria
      await createAudit(
        req,
        {
          action: 'GROUP_CREATE',
          actorId: req.user.userId,
          targetType: 'GROUP',
          targetId: group.id,
          targetName: name,
          details: {
            description,
            initial_members: userIds?.length || 0,
          },
        },
        t,
      );

      return fullGroup;
    });

    logger.logAccess('Group created', {
      userId: req.user?.userId,
      additionalInfo: {
        groupId: result.id,
        groupName: name,
        memberCount: userIds?.length || 0,
      },
    });

    return sendJsonResponse(res, result, 201);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          category: LogCategory.ADMIN,
          userId: req.user?.userId,
          additionalInfo: {
            operation: 'create_group',
            attemptedName: name,
          },
        },
      );
    }
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
      if (!req.user?.userId) {
        throw ApiError.unauthorized('Usuário não autenticado');
      }
      // Verificar se o grupo existe
      const currentGroup = await t.oneOrNone(
        'SELECT * FROM ng.groups WHERE id = $1',
        [id],
      );
      if (!currentGroup) {
        throw ApiError.notFound('Grupo não encontrado');
      }

      // Se mudar o nome, verificar se já existe
      if (name && name !== currentGroup.name) {
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

      // Atualizar membros se fornecidos
      if (userIds !== undefined) {
        await t.none(queries.UPDATE_GROUP_MEMBERS, [
          id,
          userIds,
          req.user.userId,
        ]);
      }

      const updatedGroup = await t.one(queries.GET_GROUP, [id]);

      // Adicionar auditoria
      await createAudit(
        req,
        {
          action: 'GROUP_UPDATE',
          actorId: req.user.userId,
          targetType: 'GROUP',
          targetId: id,
          targetName: currentGroup.name,
          details: {
            changes: {
              name:
                name !== undefined
                  ? {
                      old: currentGroup.name,
                      new: name,
                    }
                  : undefined,
              description:
                description !== undefined
                  ? {
                      old: currentGroup.description,
                      new: description,
                    }
                  : undefined,
              members:
                userIds !== undefined
                  ? {
                      count: userIds.length,
                    }
                  : undefined,
            },
          },
        },
        t,
      );

      return updatedGroup;
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

    return sendJsonResponse(res, result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          category: LogCategory.ADMIN,
          userId: req.user?.userId,
          additionalInfo: {
            operation: 'update_group',
            groupId: id,
            attemptedChanges: {
              name,
              description,
              memberCount: userIds?.length,
            },
          },
        },
      );
    }
    throw error;
  }
}

export async function deleteGroup(req: Request, res: Response) {
  const { id } = req.params;

  try {
    await db.tx(async t => {
      if (!req.user?.userId) {
        throw ApiError.unauthorized('Usuário não autenticado');
      }
      // Verificar se grupo existe
      const group = await t.oneOrNone(
        'SELECT g.*, COUNT(ug.user_id) as member_count FROM ng.groups g ' +
          'LEFT JOIN ng.user_groups ug ON g.id = ug.group_id ' +
          'WHERE g.id = $1 ' +
          'GROUP BY g.id',
        [id],
      );
      if (!group) {
        throw ApiError.notFound('Grupo não encontrado');
      }

      // Adicionar auditoria
      await createAudit(
        req,
        {
          action: 'GROUP_DELETE',
          actorId: req.user.userId,
          targetType: 'GROUP',
          targetId: id,
          targetName: group.name,
          details: {
            deleted_group: {
              name: group.name,
              description: group.description,
              member_count: group.member_count,
              created_at: group.created_at,
            },
          },
        },
        t,
      );

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

    return sendJsonResponse(res, { message: 'Grupo removido com sucesso' });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          category: LogCategory.ADMIN,
          userId: req.user?.userId,
          additionalInfo: {
            operation: 'delete_group',
            groupId: id,
          },
        },
      );
    }
    throw error;
  }
}

export async function getGroupDetails(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const group = await db.oneOrNone(queries.GET_GROUP, [id]);

    if (!group) {
      throw ApiError.notFound('Grupo não encontrado');
    }

    logger.logAccess('Group details retrieved', {
      userId: req.user?.userId,
      additionalInfo: {
        groupId: id,
        modelPermissions: group.model_permissions?.length || 0,
        zonePermissions: group.zone_permissions?.length || 0,
      },
    });

    return sendJsonResponse(res, group);
  } catch (error) {
    if (error instanceof ApiError) throw error;

    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ADMIN,
      userId: req.user?.userId,
      additionalInfo: {
        operation: 'get_group_details',
        groupId: id,
      },
    });
    throw error;
  }
}
