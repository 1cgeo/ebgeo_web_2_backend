import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import os from 'os';
import { promises as fs } from 'fs';
import { db } from '../../common/config/database.js';
import logger, { LogCategory } from '../../common/config/logger.js';
import { ApiError } from '../../common/errors/apiError.js';
import { analyzeRecentLogs } from './admin.logs.js';
import {
  SystemMetrics,
  SystemHealth,
  AuditQueryParams,
  ServiceHealth,
  AuditEntry,
} from './admin.types.js';
import * as queries from './admin.queries.js';
import { sendJsonResponse } from '../../common/helpers/response.js';

const MIN_DISK_SPACE_MB = 500; // Mínimo de 500MB de espaço livre requerido
const DISK_WARNING_THRESHOLD = 0.85; // 85% de uso do disco gera warning

interface DiskSpace {
  available: number;
  total: number;
  used: number;
  usedPercentage: number;
}

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

    return sendJsonResponse(res, health);
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

export function calculateCpuUsage(): number {
  const cpus = os.cpus();
  const loadAvg = os.loadavg()[0];

  // Calcula o uso real da CPU como porcentagem, limitado a 100%
  const usage = Math.min((loadAvg / cpus.length) * 100, 100);

  return Number(usage.toFixed(2)); // Retorna com 2 casas decimais
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
          usage: calculateCpuUsage(),
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

    return sendJsonResponse(res, metrics);
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

    return sendJsonResponse(res, {
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

// Função para verificar espaço em disco
async function checkDiskSpace(path: string): Promise<DiskSpace> {
  try {
    // No Windows, pegamos informação do drive onde o path está
    // No Unix/Linux, pegamos informação da partição onde o path está
    const stats = await fs.statfs(path);

    const total = stats.bsize * stats.blocks;
    const available = stats.bsize * stats.bfree;
    const used = total - available;
    const usedPercentage = (used / total) * 100;

    return {
      available,
      total,
      used,
      usedPercentage,
    };
  } catch (error) {
    throw new Error(`Failed to check disk space: ${error}`);
  }
}

// Função para testar permissões de arquivo
async function testFilePermissions(dir: string): Promise<boolean> {
  const testFile = `${dir}/test_permissions_${Date.now()}.tmp`;
  try {
    // Tenta criar um arquivo temporário
    await fs.writeFile(testFile, 'test');
    // Tenta ler o arquivo
    await fs.readFile(testFile);
    // Limpa o arquivo de teste
    await fs.unlink(testFile);
    return true;
  } catch {
    return false;
  }
}

export async function checkFileSystemHealth(
  logDir: string = 'logs',
): Promise<ServiceHealth> {
  try {
    // Verifica se o diretório existe e tem permissões básicas
    await fs.access(logDir, fs.constants.R_OK | fs.constants.W_OK);

    // Verifica permissões de arquivo
    const hasFilePermissions = await testFilePermissions(logDir);
    if (!hasFilePermissions) {
      return {
        status: 'unhealthy',
        details: {
          error: 'Insufficient file permissions',
          canWrite: false,
          canRead: false,
        },
        lastCheck: new Date(),
      };
    }

    // Verifica espaço em disco
    const diskSpace = await checkDiskSpace(logDir);
    const availableMB = diskSpace.available / (1024 * 1024);

    // Determina o status baseado no espaço disponível
    if (availableMB < MIN_DISK_SPACE_MB) {
      return {
        status: 'unhealthy',
        details: {
          error: 'Insufficient disk space',
          availableMB,
          diskUsagePercentage: diskSpace.usedPercentage,
        },
        lastCheck: new Date(),
      };
    }

    if (diskSpace.usedPercentage > DISK_WARNING_THRESHOLD * 100) {
      return {
        status: 'degraded',
        details: {
          warning: 'High disk usage',
          availableMB,
          diskUsagePercentage: diskSpace.usedPercentage,
        },
        lastCheck: new Date(),
      };
    }

    return {
      status: 'healthy',
      details: {
        availableMB,
        diskUsagePercentage: diskSpace.usedPercentage,
        canWrite: true,
        canRead: true,
      },
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: logDir,
      },
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
