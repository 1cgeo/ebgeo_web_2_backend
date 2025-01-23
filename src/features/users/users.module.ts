import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import * as queries from './users.queries.js';
import {
  CreateUserDTO,
  UpdateUserDTO,
  UpdatePasswordDTO,
  UpdateProfileDTO,
  UserQueryParams,
} from './users.types.js';
import { UserRole } from '../auth/auth.types.js';
import { createAudit } from '../../common/config/audit.js';

// Função utilitária para adicionar pepper à senha
const addPepper = (password: string): string => {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) {
    throw new Error('PASSWORD_PEPPER não configurado');
  }
  return `${password}${pepper}`;
};

export async function listUsers(
  req: Request<any, any, any, UserQueryParams>,
  res: Response,
) {
  let { page = 1, limit = 10, search, status, role } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const isActive =
      status === 'all'
        ? null
        : status === 'active'
          ? true
          : status === undefined
            ? null
            : false;
    const roleFilter = role === 'all' ? null : role === undefined ? null : role;
    const searchTerm = search === undefined ? null : search;

    const [users, total] = await Promise.all([
      db.any(queries.LIST_USERS, [
        searchTerm,
        roleFilter,
        isActive,
        limit,
        offset,
      ]),
      db.one(queries.COUNT_USERS, [searchTerm, roleFilter, isActive]),
    ]);

    logger.logAccess('Users listed', {
      userId: req.user?.userId,
      additionalInfo: {
        filters: { search, status, role },
        results: users.length,
      },
    });

    return res.json({
      users,
      total: Number(total.count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ADMIN,
      userId: req.user?.userId,
      additionalInfo: { operation: 'list_users' },
    });
    throw error;
  }
}

export async function getUserDetails(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const user = await db.one(queries.GET_USER_DETAILS, [id]);

    logger.logAccess('User details retrieved', {
      userId: req.user?.userId,
      additionalInfo: { targetUserId: id },
    });

    return res.json(user);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ADMIN,
      userId: req.user?.userId,
      additionalInfo: { operation: 'get_user_details', targetUserId: id },
    });
    throw ApiError.notFound('Usuário não encontrado');
  }
}

export async function createUser(
  req: Request<any, any, CreateUserDTO>,
  res: Response,
) {
  const { username, email, password, role, groupIds } = req.body;

  try {
    if (!req.user?.userId) {
      throw ApiError.unauthorized('Usuário não autenticado');
    }
    const result = await db.tx(async t => {
      // Verificar se username já existe
      const existingUser = await t.oneOrNone(
        'SELECT id FROM ng.users WHERE username = $1',
        [username],
      );
      if (existingUser) {
        logger.logAccess('Username já está em uso', {
          userId: req.user?.userId,
          additionalInfo: {
            operation: 'create_user',
            attemptedUsername: username,
          },
        });
        throw ApiError.conflict('Username já está em uso');
      }

      // Verificar se email já existe
      const existingEmail = await t.oneOrNone(
        'SELECT id FROM ng.users WHERE email = $1',
        [email],
      );
      if (existingEmail) {
        logger.logAccess('Email já está em uso', {
          userId: req.user?.userId,
          additionalInfo: {
            operation: 'create_user',
            attemptedemail: email,
          },
        });
        throw ApiError.conflict('Email já está em uso');
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(addPepper(password), 10);

      // Criar usuário
      const newUser = await t.one(queries.CREATE_USER, [
        username,
        email,
        hashedPassword,
        role,
        req.user?.userId,
      ]);

      // Se houver grupos, adicionar usuário aos grupos
      if (groupIds?.length) {
        await t.none(queries.ADD_USER_TO_GROUPS, [
          newUser.id,
          groupIds,
          req.user?.userId,
        ]);
      }

      // Retornar detalhes completos do usuário criado
      return t.one(queries.GET_USER_DETAILS, [newUser.id]);
    });

    await createAudit(req, {
      action: 'USER_CREATE',
      actorId: req.user.userId,
      targetType: 'USER',
      targetId: result.id,
      targetName: username,
      details: {
        role,
        email,
        groupCount: groupIds?.length || 0,
      },
    });

    logger.logAccess('User created', {
      userId: req.user?.userId,
      additionalInfo: {
        newUserId: result.id,
        username,
        role,
        groupCount: groupIds?.length,
      },
    });

    return res.status(201).json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          category: LogCategory.ADMIN,
          userId: req.user?.userId,
          additionalInfo: {
            operation: 'create_user',
            attemptedUsername: username,
          },
        },
      );
    }
    throw error;
  }
}

export async function updateUser(
  req: Request<{ id: string }, any, UpdateUserDTO>,
  res: Response,
) {
  const { id } = req.params;
  const { email, role, isActive } = req.body;

  try {
    const result = await db.tx(async t => {
      if (!req.user?.userId) {
        throw ApiError.unauthorized('Usuário não autenticado');
      }
      // Verificar se usuário existe
      const user = await t.oneOrNone('SELECT * FROM ng.users WHERE id = $1', [
        id,
      ]);
      if (!user) {
        throw ApiError.notFound('Usuário não encontrado');
      }

      // Se estiver alterando email, verificar se já existe
      if (email && email !== user.email) {
        const existingEmail = await t.oneOrNone(
          'SELECT id FROM ng.users WHERE email = $1 AND id != $2',
          [email, id],
        );
        if (existingEmail) {
          throw ApiError.conflict('Email já está em uso');
        }
      }

      // Atualizar usuário
      const updatedUser = await t.one(queries.UPDATE_USER, [
        id,
        email,
        role,
        isActive,
      ]);

      await createAudit(
        req,
        {
          action: 'USER_UPDATE',
          actorId: req.user.userId,
          targetType: 'USER',
          targetId: id,
          targetName: user.username,
          details: {
            changes: {
              email:
                email !== undefined
                  ? {
                      old: user.email,
                      new: email,
                    }
                  : undefined,
              role:
                role !== undefined
                  ? {
                      old: user.role,
                      new: role,
                    }
                  : undefined,
              isActive:
                isActive !== undefined
                  ? {
                      old: user.is_active,
                      new: isActive,
                    }
                  : undefined,
            },
          },
        },
        t,
      );

      return updatedUser;
    });

    logger.logAccess('User updated', {
      userId: req.user?.userId,
      additionalInfo: {
        targetUserId: id,
        updatedFields: {
          email: email !== undefined,
          role: role !== undefined,
          isActive: isActive !== undefined,
        },
      },
    });

    return res.json(result);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.ADMIN,
      userId: req.user?.userId,
      additionalInfo: {
        operation: 'update_user',
        targetUserId: id,
      },
    });
    throw error;
  }
}

export async function updatePassword(
  req: Request<{ id: string }, any, UpdatePasswordDTO>,
  res: Response,
) {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  const isAdmin = req.user?.role === UserRole.ADMIN;
  const isSelf = req.user?.userId === id;

  if (!isAdmin && !isSelf) {
    throw ApiError.forbidden('Não autorizado a alterar senha de outro usuário');
  }

  try {
    await db.tx(async t => {
      if (!req.user?.userId) {
        throw ApiError.unauthorized('Usuário não autenticado');
      }
      const user = await t.oneOrNone('SELECT * FROM ng.users WHERE id = $1', [
        id,
      ]);
      if (!user) {
        throw ApiError.notFound('Usuário não encontrado');
      }

      // Se não for admin, verificar senha atual
      if (!isAdmin) {
        if (!currentPassword) {
          logger.logSecurity('Senha atual é obrigatória', {
            userId: req.user?.userId,
            additionalInfo: {
              operation: 'update_password',
              targetUserId: id,
            },
          });
          throw ApiError.badRequest('Senha atual é obrigatória');
        }

        const isValidPassword = await bcrypt.compare(
          addPepper(currentPassword),
          user.password,
        );
        if (!isValidPassword) {
          logger.logSecurity('Senha atual incorreta', {
            userId: req.user?.userId,
            additionalInfo: {
              operation: 'update_password',
              targetUserId: id,
            },
          });
          throw ApiError.badRequest('Senha atual incorreta');
        }
      }

      await createAudit(
        req,
        {
          action: 'USER_UPDATE',
          actorId: req.user.userId,
          targetType: 'USER',
          targetId: id,
          targetName: user.username,
          details: {
            passwordChanged: true,
            changedBy: isAdmin ? 'admin' : 'self',
          },
        },
        t,
      );

      // Hash da nova senha
      const hashedPassword = await bcrypt.hash(addPepper(newPassword), 10);

      // Atualizar senha
      await t.one(queries.UPDATE_PASSWORD, [id, hashedPassword]);
    });

    logger.logSecurity('Password updated', {
      userId: req.user?.userId,
      additionalInfo: {
        targetUserId: id,
        updatedBy: isAdmin ? 'admin' : 'self',
      },
    });

    return res.json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          category: LogCategory.SECURITY,
          userId: req.user?.userId,
          additionalInfo: {
            operation: 'update_password',
            targetUserId: id,
          },
        },
      );
    }
    throw error;
  }
}

export async function getUserProfile(req: Request, res: Response) {
  if (!req.user) {
    throw ApiError.unauthorized('Não autenticado');
  }

  try {
    const profile = await db.one(queries.GET_USER_DETAILS, [req.user.userId]);

    // Garantir que os campos de permissões e grupos estejam estruturados corretamente
    const formattedProfile = {
      ...profile,
      groups: profile.groups || [],
      permissions: {
        models: {
          count: profile.model_permissions?.count || 0,
          items: profile.model_permissions?.items || [],
        },
        zones: {
          count: profile.zone_permissions?.count || 0,
          items: profile.zone_permissions?.items || [],
        },
      },
    };

    logger.logAccess('Profile retrieved', {
      userId: req.user.userId,
    });

    return res.json(formattedProfile);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user.userId,
      additionalInfo: { operation: 'get_profile' },
    });
    throw error;
  }
}

export async function updateProfile(
  req: Request<any, any, UpdateProfileDTO>,
  res: Response,
) {
  if (!(req.user && req.user.userId)) {
    throw ApiError.unauthorized('Não autenticado');
  }
  const userId = req.user.userId;

  const { email } = req.body;

  try {
    await db.tx(async t => {
      if (!(req.user && req.user.userId)) {
        throw ApiError.unauthorized('Usuário não autenticado');
      }
      const user = await db.one('SELECT * FROM ng.users WHERE id = $1', [
        userId,
      ]);

      if (email && email !== user.email) {
        const existingEmail = await t.oneOrNone(
          'SELECT id FROM ng.users WHERE email = $1 AND id != $2',
          [email, userId],
        );
        if (existingEmail) {
          throw ApiError.conflict('Email já está em uso');
        }
      }

      await createAudit(
        req,
        {
          action: 'USER_UPDATE',
          actorId: req.user.userId,
          targetType: 'USER',
          targetId: userId,
          targetName: req.user.username,
          details: {
            changes: {
              email:
                email !== undefined
                  ? {
                      old: user.email,
                      new: email,
                    }
                  : undefined,
            },
            changedBy: 'self',
          },
        },
        t,
      );

      await t.one(queries.UPDATE_USER, [
        userId,
        email,
        null, // role não pode ser alterado
        null, // isActive não pode ser alterado
      ]);
    });

    const updatedUser = await db.one(queries.GET_USER_DETAILS, [userId]);

    logger.logAccess('Profile updated', {
      userId: req.user.userId,
      additionalInfo: {
        updatedFields: { email: email !== undefined },
      },
    });

    return res.json(updatedUser);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.API,
      userId: req.user.userId,
      additionalInfo: { operation: 'update_profile' },
    });
    throw error;
  }
}
