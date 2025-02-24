import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import { envManager } from '../../common/config/environment.js';
import {
  LoginRequest,
  LoginResponse,
  ApiKeyResponse,
  ApiKeyHistoryResponse,
} from './auth.types.js';
import * as queries from './auth.queries.js';
import { generateToken } from './auth.middleware.js';
import { createAudit } from '../../common/config/audit.js';
import { sendJsonResponse } from '../../common/helpers/response.js';

// Função utilitária para adicionar pepper à senha
const addPepper = (password: string): string => {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) {
    throw new Error('PASSWORD_PEPPER não configurado');
  }
  return `${password}${pepper}`;
};

const isValidUUIDv4 = (uuid: string): boolean => {
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  // Primeiro converte para lowercase para garantir consistência
  const normalizedUUID = uuid.toLowerCase();

  // Verifica se o formato está correto após normalização
  if (!uuidV4Regex.test(normalizedUUID)) {
    return false;
  }

  // Verifica se o UUID original tinha caracteres inválidos
  if (uuid !== normalizedUUID) {
    return false;
  }

  return true;
};

export async function login(
  req: Request<any, any, LoginRequest>,
  res: Response,
) {
  const { username, password } = req.body;

  try {
    const user = await db.oneOrNone(queries.VALIDATE_LOGIN, [username]);

    if (!user || !user.is_active) {
      logger.logSecurity('Failed login attempt', {
        endpoint: '/api/auth/login',
        additionalInfo: {
          username,
          reason: 'invalid_credentials',
          ip: req.ip,
        },
      });
      throw ApiError.unauthorized('Credenciais inválidas');
    }

    const isValidPassword = await bcrypt.compare(
      addPepper(password),
      user.password,
    );

    if (!isValidPassword) {
      logger.logSecurity('Failed login attempt', {
        endpoint: '/api/auth/login',
        additionalInfo: {
          username,
          reason: 'invalid_credentials',
          ip: req.ip,
        },
      });
      throw ApiError.unauthorized('Credenciais inválidas');
    }

    // Atualizar último login
    await db.none(
      'UPDATE ng.users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id],
    );

    await createAudit(req, {
      action: 'ADMIN_LOGIN',
      actorId: user.id,
      targetType: 'USER',
      targetId: user.id,
      targetName: user.username,
      details: {
        role: user.role,
        timestamp: new Date(),
      },
    });

    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const token = generateToken(payload);

    const cookieConfig = envManager.getCookieConfig();

    // Definir cookie com token JWT
    res.cookie('token', token, {
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      maxAge: 15 * 60 * 1000, // 15 minutos
    });

    const response: LoginResponse = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    };

    logger.logAccess('User logged in', {
      userId: user.id,
      additionalInfo: {
        username: user.username,
        role: user.role,
      },
    });

    return sendJsonResponse(res, response);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          category: LogCategory.AUTH,
          additionalInfo: {
            username,
            operation: 'login',
          },
        },
      );
    }
    throw error;
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const cookieConfig = envManager.getCookieConfig();

    res.clearCookie('token', {
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: '/api',
      maxAge: 0,
    });

    if (req.user) {
      logger.logAccess('User logged out', {
        userId: req.user.userId,
      });
    }

    return sendJsonResponse(res, { message: 'Logout realizado com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      userId: req.user?.userId,
      additionalInfo: {
        operation: 'logout',
      },
    });
    throw error;
  }
}

export async function getApiKey(req: Request, res: Response) {
  if (!req.user?.userId) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  try {
    const result = await db.one(queries.GET_API_KEY, [req.user.userId]);

    logger.logAccess('API key retrieved', {
      userId: req.user.userId,
    });

    const response: ApiKeyResponse = {
      apiKey: result.api_key,
      generatedAt: result.api_key_created_at,
    };

    return sendJsonResponse(res, response);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      userId: req.user.userId,
      additionalInfo: {
        operation: 'get_api_key',
      },
    });
    throw error;
  }
}

export async function regenerateApiKey(req: Request, res: Response) {
  if (!req.user?.userId) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  try {
    const newApiKey = uuidv4();

    const result = await db.one(queries.UPDATE_USER_API_KEY, [
      req.user.userId,
      newApiKey,
      req.user.userId,
    ]);

    await createAudit(req, {
      action: 'API_KEY_REGENERATE',
      actorId: req.user.userId,
      targetType: 'USER',
      targetId: req.user.userId,
      targetName: req.user.username,
      details: {
        previousKeyCreatedAt: result.api_key_created_at,
      },
    });

    logger.logSecurity('API key regenerated', {
      userId: req.user.userId,
      additionalInfo: {
        username: req.user.username,
      },
    });

    const response: ApiKeyResponse = {
      apiKey: result.api_key,
      generatedAt: result.api_key_created_at,
    };

    return sendJsonResponse(res, response, 201);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      userId: req.user.userId,
      additionalInfo: {
        operation: 'regenerate_api_key',
      },
    });
    throw error;
  }
}

export async function getApiKeyHistory(req: Request, res: Response) {
  if (!req.user?.userId) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  try {
    const history = await db.any(queries.GET_API_KEY_HISTORY, [
      req.user.userId,
    ]);

    logger.logAccess('API key history retrieved', {
      userId: req.user.userId,
      additionalInfo: {
        historyCount: history.length,
      },
    });

    const response: ApiKeyHistoryResponse = {
      userId: req.user.userId,
      history,
    };

    return sendJsonResponse(res, response);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      userId: req.user.userId,
      additionalInfo: {
        operation: 'get_api_key_history',
      },
    });
    throw error;
  }
}

export async function validateApiKey(req: Request, res: Response) {
  const apiKey =
    req.query.api_key?.toString() || req.headers['x-api-key']?.toString();

  if (!apiKey) {
    logger.logSecurity('Missing API key in validation request', {
      additionalInfo: {
        ip: req.ip,
        path: req.path,
      },
    });
    return sendJsonResponse(res, { message: 'API key não fornecida' }, 401);
  }

  if (!isValidUUIDv4(apiKey)) {
    logger.logSecurity('Invalid API key format', {
      additionalInfo: {
        ip: req.ip,
        path: req.path,
        reason: 'invalid_format',
      },
    });
    return sendJsonResponse(res, { message: 'API key inválida' }, 401);
  }

  try {
    const user = await db.oneOrNone(queries.VALIDATE_API_KEY, [apiKey]);

    if (!user || !user.is_active) {
      logger.logSecurity('Invalid API key validation attempt', {
        additionalInfo: {
          ip: req.ip,
          path: req.path,
        },
      });
      return sendJsonResponse(res, { message: 'API key inválida' }, 401);
    }

    logger.logAccess('API key validated successfully', {
      userId: user.id,
      additionalInfo: {
        username: user.username,
        role: user.role,
      },
    });

    return sendJsonResponse(res, { message: 'API key válida' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      additionalInfo: {
        operation: 'validate_api_key',
      },
    });
    throw error;
  }
}
