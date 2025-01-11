// src/features/auth/permissions.module.ts

import { Request, Response } from 'express';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import { ModelPermissionUpdate } from './auth.types.js';
import { SHARE_MODEL, GET_MODEL_ACCESS } from './auth.queries.js';

export const updateModelPermissions = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { modelId, accessLevel, sharedWith } =
    req.body as ModelPermissionUpdate;

  try {
    // Verificar se o modelo existe
    const modelExists = await db.oneOrNone(
      'SELECT id FROM ng.catalogo_3d WHERE id = $1',
      [modelId],
    );

    if (!modelExists) {
      throw ApiError.notFound('Modelo não encontrado');
    }

    const result = await db.one(SHARE_MODEL, [
      modelId,
      accessLevel,
      sharedWith,
      req.user.userId,
    ]);

    logger.info('Model permissions updated', {
      modelId,
      accessLevel,
      updatedBy: req.user.userId,
      sharedWith,
    });

    return res.json({
      message: 'Permissões atualizadas com sucesso',
      permissions: result,
    });
  } catch (error) {
    logger.error('Error updating model permissions:', { error, modelId });
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.internal('Erro ao atualizar permissões do modelo');
  }
};

export const getModelPermissions = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  const { modelId } = req.params;

  try {
    // Verificar se o modelo existe
    const modelExists = await db.oneOrNone(
      'SELECT id FROM ng.catalogo_3d WHERE id = $1',
      [modelId],
    );

    if (!modelExists) {
      throw ApiError.notFound('Modelo não encontrado');
    }

    const permissions = await db.oneOrNone(GET_MODEL_ACCESS, [
      req.user.userId,
      modelId,
    ]);

    if (!permissions) {
      throw ApiError.notFound('Configurações de permissão não encontradas');
    }

    return res.json(permissions);
  } catch (error) {
    logger.error('Error getting model permissions:', { error, modelId });
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.internal('Erro ao buscar permissões do modelo');
  }
};

// Rota usada pelo nginx auth_request
export const validateApiKeyRequest = async (req: Request, res: Response) => {
  const apiKey =
    req.query.api_key?.toString() || req.headers['x-api-key']?.toString();

  if (!apiKey) {
    logger.warn('No API key provided in request');
    return res.status(401).json({ message: 'API key não fornecida' });
  }

  try {
    const user = await db.oneOrNone(
      'SELECT id, username, role, is_active FROM ng.users WHERE api_key = $1',
      [apiKey],
    );

    if (!user) {
      logger.warn('Invalid API key used', { apiKey });
      return res.status(401).json({ message: 'API key inválida' });
    }

    if (!user.is_active) {
      logger.warn('Inactive user attempted to use API key', {
        userId: user.id,
        username: user.username,
      });
      return res.status(403).json({ message: 'Usuário inativo' });
    }

    logger.info('API key validated successfully', {
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // nginx auth_request espera status 200 para autorizar
    return res.status(200).json({ message: 'API key válida' });
  } catch (error) {
    logger.error('Error validating API key:', { error });
    return res.status(500).json({ message: 'Erro ao validar API key' });
  }
};
