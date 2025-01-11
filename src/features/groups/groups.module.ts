import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
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

    logger.info('Retrieved user groups', {
      userId: req.user.userId,
      groupCount: userGroups.length,
    });

    return res.json(userGroups);
  } catch (error) {
    logger.error('Error retrieving user groups:', {
      error,
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

    logger.info('New group created', {
      groupId: newGroup.id,
      createdBy: req.user.userId,
      name: newGroup.name,
    });

    return res.status(201).json(newGroup);
  } catch (error) {
    logger.error('Error creating group:', {
      error,
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

    // Construir query de atualização dinamicamente
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    values.push(groupId);

    const updatedGroup = await db.one(
      `UPDATE ng.groups 
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount}
         RETURNING id, name, description, updated_at`,
      values,
    );

    logger.info('Group updated', {
      groupId,
      updatedBy: req.user.userId,
      updates: { name, description },
    });

    return res.json(updatedGroup);
  } catch (error) {
    logger.error('Error updating group:', {
      error,
      groupId,
      userId: req.user.userId,
      requestId: req.requestId,
    });
    throw error;
  }
};
