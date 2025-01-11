import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import { UserRole, User } from './auth.types.js';
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

    // Atualizar último login
    await db.none(queries.UPDATE_USER_LAST_LOGIN, [user.id]);

    // Gerar token JWT
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      apiKey: user.apiKey,
    });

    // Definir cookie seguro
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none',
      maxAge: 15 * 60 * 1000, // 15 minutos
    });

    logger.info('User logged in successfully', {
      userId: user.id,
      username: user.username,
      requestId: req.requestId,
    });

    // Retornar dados do usuário (sem senha)
    const { password: _, ...userWithoutPassword } = user;
    return res.json({
      user: userWithoutPassword,
      token, // Opcional: retornar token no response
    });
  } catch (error) {
    logger.error('Login error:', { error, username, requestId: req.requestId });
    throw error;
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    // Limpar cookie do token
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none',
    });

    logger.info('User logged out', {
      userId: req.user?.userId,
      requestId: req.requestId,
    });

    return res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    logger.error('Logout error:', {
      error,
      userId: req.user?.userId,
      requestId: req.requestId,
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

    logger.info('API key regenerated', {
      userId: req.user.userId,
      username: req.user.username,
      requestId: req.requestId,
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
    logger.error('Error generating new API key:', {
      error,
      userId: req.user.userId,
      requestId: req.requestId,
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
    logger.error('Error retrieving API key:', {
      error,
      userId: req.user.userId,
      requestId: req.requestId,
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

    logger.info('New user created', {
      createdBy: req.user.userId,
      newUserId: newUser.id,
      username: newUser.username,
    });

    const { password: _, ...userWithoutPassword } = newUser;
    return res.status(201).json(userWithoutPassword);
  } catch (error) {
    logger.error('Error creating user:', {
      error,
      adminId: req.user.userId,
    });
    throw error;
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
