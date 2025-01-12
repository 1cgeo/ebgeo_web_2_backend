// src/features/admin/admin.module.ts

import { Request, Response } from 'express';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { db } from '../../common/config/database.js';
import logger from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import * as queries from './admin.queries.js';
import {
  LogQueryParams,
  UserUpdateData,
  SystemMetrics,
  UserListResponse,
  GroupMembersResponse,
  LogResponse,
} from './admin.types.js';
import { LogCategory } from '../../common/config/logger.js';

// Constantes
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Utilitários
const addPepper = (password: string): string => {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) {
    throw new Error('PASSWORD_PEPPER environment variable is not set');
  }
  return `${password}${pepper}`;
};

// Gestão de Usuários
export async function listUsers(req: Request, res: Response) {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    role,
    sortBy = 'created_at_desc',
  } = req.query;

  try {
    const offset = (Number(page) - 1) * Number(limit);
    const isActive = status === 'all' ? null : status === 'active';
    const roleFilter = role === 'all' ? null : role;

    const [users, countResult] = await Promise.all([
      db.any(queries.LIST_USERS, [
        search,
        roleFilter,
        isActive,
        sortBy,
        limit,
        offset,
      ]),
      db.one(queries.COUNT_USERS, [search, roleFilter, isActive]),
    ]);

    const response: UserListResponse = {
      users,
      total: parseInt(countResult.count),
      page: Number(page),
      limit: Number(limit),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error listing users:', {
      error,
      category: LogCategory.ADMIN,
      queryParams: { search, status, role, page, limit },
    });
    throw ApiError.internal('Erro ao listar usuários');
  }
}

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const updateData: UserUpdateData = req.body;

  try {
    await db.tx(async t => {
      // Verificar se usuário existe
      const user = await t.oneOrNone('SELECT id FROM ng.users WHERE id = $1', [
        id,
      ]);
      if (!user) {
        throw ApiError.notFound('Usuário não encontrado');
      }

      let updates = [];
      let values = [id];
      let paramCount = 2;

      if (updateData.email) {
        // Verificar se email já existe
        const emailExists = await t.oneOrNone(
          'SELECT id FROM ng.users WHERE email = $1 AND id != $2',
          [updateData.email, id],
        );
        if (emailExists) {
          throw ApiError.conflict('Email já está em uso');
        }
        updates.push(`email = $${paramCount}`);
        values.push(updateData.email);
        paramCount++;
      }

      if (updateData.role) {
        updates.push(`role = $${paramCount}`);
        values.push(updateData.role);
        paramCount++;
      }

      if (typeof updateData.isActive === 'boolean') {
        updates.push(`is_active = ${paramCount}`);
        values.push(updateData.isActive.toString());
        paramCount++;
      }

      if (updateData.password) {
        const hashedPassword = await bcrypt.hash(
          addPepper(updateData.password),
          10,
        );
        updates.push(`password = $${paramCount}`);
        values.push(hashedPassword);
        paramCount++;
      }

      if (updates.length === 0) {
        throw ApiError.badRequest('Nenhum dado para atualizar');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');

      const updatedUser = await t.one(
        `
        UPDATE ng.users 
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING id, username, email, role, is_active, updated_at
        `,
        values,
      );

      return updatedUser;
    });

    return res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    logger.error('Error updating user:', {
      error,
      category: LogCategory.ADMIN,
      userId: id,
    });
    throw error;
  }
}

// Gestão de Grupos
export async function getGroupMembers(req: Request, res: Response) {
  const { groupId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const [members, countResult] = await Promise.all([
      db.any(queries.GET_GROUP_MEMBERS, [groupId, limit, offset]),
      db.one(queries.COUNT_GROUP_MEMBERS, [groupId]),
    ]);

    const response: GroupMembersResponse = {
      members,
      total: parseInt(countResult.count),
      page: Number(page),
      limit: Number(limit),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error getting group members:', {
      error,
      category: LogCategory.ADMIN,
      groupId,
    });
    throw error;
  }
}

// Logs
export async function queryLogs(req: Request, res: Response) {
  const {
    startDate,
    endDate,
    level,
    category,
    search,
    page = 1,
    limit = 100,
  } = req.query as unknown as LogQueryParams;

  try {
    const logDir = process.env.LOG_DIR || 'logs';
    const files = await fs.readdir(logDir);
    const logFiles = files.filter(file => {
      // Filtrar arquivos de log relevantes baseado nas datas
      if (startDate || endDate) {
        const fileDate = file.match(/\d{4}-\d{2}-\d{2}/)?.[0];
        if (fileDate) {
          if (startDate && fileDate < startDate) return false;
          if (endDate && fileDate > endDate) return false;
        }
      }
      return file.endsWith('.log');
    });

    let logs: any[] = [];

    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);

      // Pular arquivos muito grandes
      if (stats.size > MAX_LOG_FILE_SIZE) {
        logger.warn(`Skipping large log file: ${file}`, {
          category: LogCategory.ADMIN,
          fileSize: stats.size,
        });
        continue;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      const parsedLogs = lines
        .map(line => {
          try {
            const log = JSON.parse(line);
            // Sanitizar dados sensíveis
            if (log.password) delete log.password;
            if (log.token) delete log.token;
            if (log.apiKey) delete log.apiKey;
            return log;
          } catch {
            return null;
          }
        })
        .filter(log => {
          if (!log) return false;

          if (startDate && log.timestamp < startDate) return false;
          if (endDate && log.timestamp > endDate) return false;
          if (level && log.level !== level) return false;
          if (category && log.category !== category) return false;
          if (
            search &&
            !JSON.stringify(log).toLowerCase().includes(search.toLowerCase())
          )
            return false;

          return true;
        });

      logs = [...logs, ...parsedLogs];
    }

    logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const start = (page - 1) * limit;
    const paginatedLogs = logs.slice(start, start + limit);

    const response: LogResponse = {
      logs: paginatedLogs,
      total: logs.length,
      page: Number(page),
      limit: Number(limit),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error querying logs:', {
      error,
      category: LogCategory.ADMIN,
      queryParams: { startDate, endDate, level, category },
    });
    throw ApiError.internal('Erro ao consultar logs');
  }
}

export async function exportLogs(req: Request, res: Response) {
  const query = req.query as unknown as LogQueryParams;
  const MAX_EXPORT_SIZE = 50 * 1024 * 1024; // 50MB

  try {
    const logDir = process.env.LOG_DIR || 'logs';
    const files = await fs.readdir(logDir);
    const logFiles = files.filter(file => file.endsWith('.log'));

    let totalSize = 0;
    let logs: any[] = [];

    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);

      totalSize += stats.size;
      if (totalSize > MAX_EXPORT_SIZE) {
        throw ApiError.badRequest(
          'Volume de logs excede o limite permitido para exportação',
        );
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      const filteredLogs = lines
        .map(line => {
          try {
            const log = JSON.parse(line);
            // Sanitizar dados sensíveis
            if (log.password) delete log.password;
            if (log.token) delete log.token;
            if (log.apiKey) delete log.apiKey;

            if (
              (query.startDate && log.timestamp < query.startDate) ||
              (query.endDate && log.timestamp > query.endDate) ||
              (query.level && log.level !== query.level) ||
              (query.category && log.category !== query.category)
            ) {
              return null;
            }
            return log;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      logs = [...logs, ...filteredLogs];
    }

    logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=logs-export.json',
    );

    return res.json(logs);
  } catch (error) {
    logger.error('Error exporting logs:', {
      error,
      category: LogCategory.ADMIN,
    });
    throw error;
  }
}

// Métricas do Sistema
export async function getSystemMetrics(_req: Request, res: Response) {
  try {
    const [userMetrics, groupMetrics, modelMetrics, dbStatus] =
      await Promise.all([
        db.one(queries.GET_USER_METRICS),
        db.one(queries.GET_GROUP_METRICS),
        db.one(queries.GET_MODEL_METRICS),
        db.one(queries.GET_DB_STATUS),
      ]);

    const cpus = os.cpus();

    const metrics: SystemMetrics = {
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        memory: {
          total: os.totalmem(),
          used: os.totalmem() - os.freemem(),
          free: os.freemem(),
        },
        cpu: {
          usage: (os.loadavg()[0] / cpus.length) * 100,
          loadAvg: os.loadavg(),
        },
      },
      database: {
        connectionPool: {
          total: dbStatus.total_connections,
          active: dbStatus.active_connections,
          idle: dbStatus.idle_connections,
        },
      },
      usage: {
        totalUsers: userMetrics.total_users,
        activeUsers: userMetrics.active_users,
        totalGroups: groupMetrics.total_groups,
        totalModels: {
          total: modelMetrics.total_models,
          public: modelMetrics.public_models,
          private: modelMetrics.private_models,
        },
      },
      logs: await analyzeRecentLogs(),
    };

    return res.json(metrics);
  } catch (error) {
    logger.error('Error getting system metrics:', {
      error,
      category: LogCategory.ADMIN,
    });
    throw ApiError.internal('Erro ao obter métricas do sistema');
  }
}

async function analyzeRecentLogs() {
  try {
    const logDir = process.env.LOG_DIR || 'logs';
    const files = await fs.readdir(logDir);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let errors = 0;
    let warnings = 0;
    let totalRequests = 0;

    for (const file of files) {
      if (!file.endsWith('.log')) continue;

      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);

      // Pular arquivos muito antigos baseado no nome ou data de modificação
      const fileDate = file.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (fileDate && new Date(fileDate) < twentyFourHoursAgo) continue;
      if (stats.mtime < twentyFourHoursAgo) continue;

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          if (new Date(log.timestamp) < twentyFourHoursAgo) continue;

          if (log.level === 'ERROR') errors++;
          if (log.level === 'WARN') warnings++;
          if (log.category === LogCategory.API) totalRequests++;
        } catch {
          continue;
        }
      }
    }

    return {
      errors24h: errors,
      warnings24h: warnings,
      totalRequests24h: totalRequests,
    };
  } catch (error) {
    logger.error('Error analyzing logs:', {
      error,
      category: LogCategory.ADMIN,
    });
    return {
      errors24h: 0,
      warnings24h: 0,
      totalRequests24h: 0,
    };
  }
}
