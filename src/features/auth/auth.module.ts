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

// Função utilitária para adicionar pepper à senha
const addPepper = (password: string): string => {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) {
    throw new Error('PASSWORD_PEPPER não configurado');
  }
  return `${password}${pepper}`;
};

export async function login(
  req: Request<any, any, LoginRequest>,
  res: Response,
) {
  const { username, password } = req.body;

  try {
    const user = await db.oneOrNone(queries.VALIDATE_LOGIN, [username]);

    if (!user || !user.is_active) {
      throw ApiError.unauthorized('Credenciais inválidas');
    }

    const isValidPassword = await bcrypt.compare(
      addPepper(password),
      user.password,
    );

    if (!isValidPassword) {
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

    return res.json(response);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      additionalInfo: {
        username,
        operation: 'login',
      },
    });
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
    });

    if (req.user) {
      logger.logAccess('User logged out', {
        userId: req.user.userId,
      });
    }

    return res.json({ message: 'Logout realizado com sucesso' });
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

    return res.json(response);
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

    return res.json(response);
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

    return res.json(response);
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
    return res.status(401).json({ message: 'API key não fornecida' });
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
      return res.status(401).json({ message: 'API key inválida' });
    }

    logger.logAccess('API key validated successfully', {
      userId: user.id,
      additionalInfo: {
        username: user.username,
        role: user.role,
      },
    });

    return res.json({ message: 'API key válida' });
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
