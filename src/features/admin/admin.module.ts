import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import os from 'os';
import { promises as fs } from 'fs';
import path from 'path';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import {
  SystemMetrics,
  SystemHealth,
  LogQueryParams,
  AuditQueryParams,
  LogEntry,
  ServiceHealth,
  AuditEntry,
} from './admin.types.js';
import * as queries from './admin.queries.js';

// Health Check
export async function getSystemHealth(_req: Request, res: Response) {
  try {
    const startTime = process.hrtime();

    // Verificar serviços
    const [dbHealth, fileSystemHealth, authHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkFileSystemHealth(),
      checkAuthHealth(),
    ]);

    // Calcular métricas de API
    const apiHealth = checkApiHealth(startTime);

    // Coletar métricas do sistema
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const health: SystemHealth = {
      status: getOverallStatus([
        dbHealth,
        fileSystemHealth,
        authHealth,
        apiHealth,
      ]),
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services: {
        database: dbHealth,
        fileSystem: fileSystemHealth,
        auth: authHealth,
        api: apiHealth,
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentUsed: (usedMemory / totalMemory) * 100,
      },
    };

    return res.json(health);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        operation: 'health_check',
      },
    });
    throw ApiError.internal('Erro ao verificar saúde do sistema');
  }
}

// System Metrics
export async function getSystemMetrics(_req: Request, res: Response) {
  try {
    const [dbStatus, userMetrics, modelMetrics, groupMetrics] =
      await Promise.all([
        db.one(queries.GET_DB_METRICS),
        db.one(queries.GET_USER_METRICS),
        db.one(queries.GET_MODEL_METRICS),
        db.one(queries.GET_GROUP_METRICS),
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
          total: parseInt(dbStatus.total_connections),
          active: parseInt(dbStatus.active_connections),
          idle: parseInt(dbStatus.idle_connections),
        },
      },
      usage: {
        totalUsers: parseInt(userMetrics.total_users),
        activeUsers: parseInt(userMetrics.active_users),
        totalGroups: parseInt(groupMetrics.total_groups),
        totalModels: {
          total: parseInt(modelMetrics.total_models),
          public: parseInt(modelMetrics.public_models),
          private: parseInt(modelMetrics.private_models),
        },
      },
      logs: await analyzeRecentLogs(),
    };

    return res.json(metrics);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        operation: 'get_metrics',
      },
    });
    throw ApiError.internal('Erro ao obter métricas do sistema');
  }
}

// Logs
export async function queryLogs(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.unprocessableEntity('Parâmetros de consulta inválidos', {
      errors: errors.array(),
    });
  }

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
    const logs = await processLogFiles(logDir, {
      startDate,
      endDate,
      level,
      category,
      search,
    });

    const start = (Number(page) - 1) * Number(limit);
    const paginatedLogs = logs.slice(start, start + Number(limit));

    return res.json({
      logs: paginatedLogs,
      total: logs.length,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        operation: 'query_logs',
      },
    });
    throw ApiError.internal('Erro ao consultar logs');
  }
}

// Audit Trail
export async function queryAudit(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.unprocessableEntity('Parâmetros de consulta inválidos', {
      errors: errors.array(),
    });
  }

  const {
    startDate,
    endDate,
    action,
    actorId,
    targetId,
    search,
    page = 1,
    limit = 20,
  } = req.query as unknown as AuditQueryParams;

  try {
    const offset = (Number(page) - 1) * Number(limit);
    const result = await db.any(queries.GET_AUDIT_ENTRIES, [
      startDate,
      endDate,
      action,
      actorId,
      targetId,
      search,
      limit,
      offset,
    ]);

    const entries = result.map(formatAuditEntry);
    const total = result[0]?.total_count || 0;

    return res.json({
      entries,
      total: Number(total),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        operation: 'query_audit',
      },
    });
    throw ApiError.internal('Erro ao consultar trilha de auditoria');
  }
}

// Funções auxiliares
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  try {
    const startTime = Date.now();
    await db.one(queries.CHECK_DB_HEALTH);
    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      details: { responseTime },
      lastCheck: new Date(),
    };
  } catch {
    return {
      status: 'unhealthy',
      details: { error: 'Database connection failed' },
      lastCheck: new Date(),
    };
  }
}

async function checkFileSystemHealth(): Promise<ServiceHealth> {
  try {
    const logDir = process.env.LOG_DIR || 'logs';
    await fs.access(logDir, fs.constants.R_OK | fs.constants.W_OK);

    return {
      status: 'healthy',
      lastCheck: new Date(),
    };
  } catch {
    return {
      status: 'unhealthy',
      details: { error: 'File system access failed' },
      lastCheck: new Date(),
    };
  }
}

async function checkAuthHealth(): Promise<ServiceHealth> {
  try {
    const hasJwtSecret = !!process.env.JWT_SECRET;
    const hasAuthConfig = !!process.env.PASSWORD_PEPPER;

    return {
      status: hasJwtSecret && hasAuthConfig ? 'healthy' : 'degraded',
      details: {
        jwtConfigured: hasJwtSecret,
        authConfigured: hasAuthConfig,
      },
      lastCheck: new Date(),
    };
  } catch {
    return {
      status: 'unhealthy',
      details: { error: 'Auth configuration check failed' },
      lastCheck: new Date(),
    };
  }
}

function checkApiHealth(startTime: [number, number]): ServiceHealth {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const responseTime = seconds * 1000 + nanoseconds / 1000000;

  return {
    status: responseTime < 500 ? 'healthy' : 'degraded',
    details: { responseTime },
    lastCheck: new Date(),
  };
}

function getOverallStatus(services: ServiceHealth[]): SystemHealth['status'] {
  if (services.some(s => s.status === 'unhealthy')) return 'unhealthy';
  if (services.some(s => s.status === 'degraded')) return 'degraded';
  return 'healthy';
}

async function analyzeRecentLogs() {
  const logDir = process.env.LOG_DIR || 'logs';
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let errors = 0;
  let warnings = 0;
  let totalRequests = 0;

  try {
    const files = await fs.readdir(logDir);
    for (const file of files) {
      if (!file.endsWith('.log')) continue;

      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);

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
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        operation: 'analyze_logs',
      },
    });
  }

  return {
    errors24h: errors,
    warnings24h: warnings,
    totalRequests24h: totalRequests,
  };
}

async function processLogFiles(
  logDir: string,
  filters: Omit<LogQueryParams, 'page' | 'limit'>,
): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];
  const files = await fs.readdir(logDir);

  for (const file of files) {
    if (!file.endsWith('.log')) continue;

    const filePath = path.join(logDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const log = JSON.parse(line);
        if (matchesLogFilters(log, filters)) {
          logs.push(formatLogEntry(log));
        }
      } catch {
        continue;
      }
    }
  }

  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function matchesLogFilters(
  log: any,
  filters: Omit<LogQueryParams, 'page' | 'limit'>,
): boolean {
  if (
    filters.startDate &&
    new Date(log.timestamp) < new Date(filters.startDate)
  ) {
    return false;
  }
  if (filters.endDate && new Date(log.timestamp) > new Date(filters.endDate)) {
    return false;
  }
  if (filters.level && log.level !== filters.level) {
    return false;
  }
  if (filters.category && log.category !== filters.category) {
    return false;
  }
  if (
    filters.search &&
    !JSON.stringify(log).toLowerCase().includes(filters.search.toLowerCase())
  ) {
    return false;
  }
  return true;
}

function formatLogEntry(log: any): LogEntry {
  return {
    timestamp: log.timestamp,
    level: log.level,
    category: log.category,
    message: log.msg || log.message,
    details: {
      ...log,
      timestamp: undefined,
      level: undefined,
      category: undefined,
      msg: undefined,
      message: undefined,
    },
  };
}

function formatAuditEntry(row: any): AuditEntry {
  return {
    id: row.id,
    timestamp: row.created_at,
    action: row.action,
    actor: {
      id: row.actor_id,
      username: row.actor_username,
    },
    target: row.target_type
      ? {
          type: row.target_type,
          id: row.target_id,
          name: row.target_name,
        }
      : undefined,
    details: row.details,
    ip: row.ip,
    userAgent: row.user_agent,
  };
}
