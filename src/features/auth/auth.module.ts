import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import { UserRole, User } from './auth.types.js';
import * as queries from './auth.queries.js';
import { generateToken } from './auth.middleware.js';

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

    if (!user || !(await bcrypt.compare(password, user.password))) {
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutos
    });

    logger.info('User logged in successfully', {
      userId: user.id,
      username: user.username,
    });

    // Retornar dados do usuário (sem senha)
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ user: userWithoutPassword });
  } catch (error) {
    logger.error('Login error:', { error, username });
    throw error;
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie('token');
  return res.json({ message: 'Logout realizado com sucesso' });
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
    const hashedPassword = await bcrypt.hash(password, 10);
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
