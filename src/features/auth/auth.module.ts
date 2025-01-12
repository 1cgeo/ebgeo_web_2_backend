import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import { envManager } from '../../common/config/environment.js';
import {
  UserRole,
  User,
  ApiKeyHistoryEntry,
  ApiKeyHistoryResponse,
} from './auth.types.js';
import * as queries from './auth.queries.js';
import { generateToken } from './auth.middleware.js';

const addPepper = (password: string): string => {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) {
    throw new Error('PASSWORD_PEPPER environment variable is not set');
  }
  return `${password}${pepper}`;
};

interface LoginRequest extends Request {
  body: {
    username: string;
    password: string;
  };
}

interface CreateUserRequest extends Request {
  body: {
    username: string;
    password: string;
    email: string;
    role: UserRole;
  };
}

export const login = async (req: LoginRequest, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await db.oneOrNone<User>(queries.GET_USER_BY_USERNAME, [
      username,
    ]);

    const pepperedPassword = addPepper(password);

    if (!user || !(await bcrypt.compare(pepperedPassword, user.password))) {
      throw ApiError.unauthorized('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Usuário inativo');
    }

    await db.none(queries.UPDATE_USER_LAST_LOGIN, [user.id]);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      apiKey: user.apiKey,
    });

    const cookieConfig = envManager.getCookieConfig();

    // Definir cookie com configurações baseadas no ambiente
    res.cookie('token', token, {
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      maxAge: 15 * 60 * 1000, // 15 minutos
    });

    logger.logAuth('User logged in successfully', {
      userId: user.id,
      requestId: req.requestId,
      additionalInfo: {
        username: user.username,
        environment: envManager.getEnvironment(),
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return res.json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      requestId: req.requestId,
      additionalInfo: {
        username,
        operation: 'login',
      },
    });
    throw error;
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const cookieConfig = envManager.getCookieConfig();

    // Limpar cookie com configurações baseadas no ambiente
    res.clearCookie('token', {
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
    });

    logger.logAuth('User logged out', {
      userId: req.user?.userId,
      requestId: req.requestId,
    });

    return res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      userId: req.user?.userId,
      requestId: req.requestId,
      additionalInfo: {
        operation: 'logout',
      },
    });
    throw error;
  }
};

export const generateNewApiKey = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  try {
    // Gerar nova API key
    const newApiKey = uuidv4();

    // Atualizar API key e registrar no histórico
    const result = await db.one(queries.UPDATE_USER_API_KEY, [
      req.user.userId,
      newApiKey,
      req.user.userId, // revoked_by
    ]);

    // Buscar histórico de API keys
    const history = await db.any(queries.GET_USER_API_KEY_HISTORY, [
      req.user.userId,
    ]);

    logger.logSecurity('API key regenerated', {
      userId: req.user.userId,
      requestId: req.requestId,
      additionalInfo: {
        username: req.user.username,
        operation: 'api_key_regenerate',
      },
    });

    return res.json({
      apiKey: result.api_key,
      generatedAt: result.api_key_created_at,
      previousKeys: history.map(h => ({
        apiKey: h.api_key,
        createdAt: h.created_at,
        revokedAt: h.revoked_at,
      })),
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      userId: req.user.userId,
      requestId: req.requestId,
      additionalInfo: {
        operation: 'api_key_generation',
      },
    });
    throw ApiError.internal('Erro ao gerar nova API key');
  }
};

export const getUserApiKey = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  try {
    const user = await db.oneOrNone(queries.GET_USER_BY_USERNAME, [
      req.user.username,
    ]);

    if (!user) {
      throw ApiError.notFound('Usuário não encontrado');
    }

    return res.json({
      apiKey: user.api_key,
      username: user.username,
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      userId: req.user.userId,
      requestId: req.requestId,
      additionalInfo: {
        operation: 'api_key_retrieval',
      },
    });
    throw error;
  }
};

export const createUser = async (req: CreateUserRequest, res: Response) => {
  // Verificar se o usuário está autenticado e é admin
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    throw ApiError.forbidden('Apenas administradores podem criar usuários');
  }

  const { username, password, email, role } = req.body;

  try {
    const pepperedPassword = addPepper(password);
    const hashedPassword = await bcrypt.hash(pepperedPassword, 10);
    const apiKey = uuidv4();

    const newUser = await db.one(queries.CREATE_USER, [
      username,
      hashedPassword,
      email,
      role,
      apiKey,
    ]);

    logger.logAuth('User created', {
      userId: req.user.userId,
      additionalInfo: {
        createdUserId: newUser.id,
        username: newUser.username,
        role: newUser.role,
        operation: 'user_creation',
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;
    return res.status(201).json(userWithoutPassword);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.AUTH,
      userId: req.user.userId,
      additionalInfo: {
        operation: 'user_creation',
      },
    });
    throw error;
  }
};

// Rota usada pelo nginx auth_request
export const validateApiKeyRequest = async (req: Request, res: Response) => {
  const apiKey =
    req.query.api_key?.toString() || req.headers['x-api-key']?.toString();

  if (!apiKey) {
    logger.logSecurity('Authentication failed', {
      category: LogCategory.SECURITY,
      requestId: req.id,
      additionalInfo: {
        reason: 'missing_api_key',
        operation: 'api_key_validation',
        path: req.path,
        method: req.method,
        ip: req.ip,
      },
    });
    return res.status(401).json({ message: 'API key não fornecida' });
  }

  try {
    const user = await db.oneOrNone(
      'SELECT id, username, role, is_active FROM ng.users WHERE api_key = $1',
      [apiKey],
    );

    if (!user) {
      logger.logSecurity('Invalid API key attempt', {
        additionalInfo: {
          apiKey,
          operation: 'api_key_validation',
        },
      });
      return res.status(401).json({ message: 'API key inválida' });
    }

    if (!user.is_active) {
      logger.logSecurity('Inactive user API key attempt', {
        userId: user.id,
        additionalInfo: {
          username: user.username,
          operation: 'api_key_validation',
        },
      });
      return res.status(403).json({ message: 'Usuário inativo' });
    }

    logger.logSecurity('API key validated', {
      userId: user.id,
      additionalInfo: {
        username: user.username,
        role: user.role,
        operation: 'api_key_validation',
      },
    });

    // nginx auth_request espera status 200 para autorizar
    return res.status(200).json({ message: 'API key válida' });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      additionalInfo: {
        operation: 'api_key_validation',
      },
    });
    return res.status(500).json({ message: 'Erro ao validar API key' });
  }
};

export const getApiKeyHistory = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Usuário não autenticado');
  }

  try {
    const history = await db.any(queries.GET_USER_API_KEY_HISTORY, [
      req.user.userId,
    ]);

    // Transformar os dados para um formato mais amigável
    const formattedHistory: ApiKeyHistoryEntry[] = history.map(entry => ({
      apiKey: entry.api_key,
      createdAt: entry.created_at,
      revokedAt: entry.revoked_at,
      isActive: !entry.revoked_at,
    }));

    logger.logAccess('API key history retrieved', {
      userId: req.user.userId,
      additionalInfo: {
        entriesCount: history.length,
        operation: 'api_key_history',
      },
    });

    const response: ApiKeyHistoryResponse = {
      userId: req.user.userId,
      history: formattedHistory,
    };

    return res.json(response);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SECURITY,
      userId: req.user.userId,
      requestId: req.requestId,
      additionalInfo: {
        operation: 'api_key_history_retrieval',
      },
    });
    throw ApiError.internal('Erro ao buscar histórico de API keys');
  }
};
