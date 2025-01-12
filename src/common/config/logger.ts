import { pino } from 'pino';
import { pinoCaller } from 'pino-caller';
import { TransportTargetOptions } from 'pino';
import fs from 'fs';

// Definição das categorias de log
export enum LogCategory {
  AUTH = 'AUTH',
  API = 'API',
  DB = 'DB',
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE',
  SYSTEM = 'SYSTEM',
  ACCESS = 'ACCESS',
  ADMIN = 'ADMIN',
}

// Interface para log estruturado
export interface LogDetails {
  category: LogCategory;
  requestId?: string;
  userId?: string;
  username?: string;
  endpoint?: string;
  duration?: number;
  statusCode?: number;
  errorCode?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  query?: Record<string, any>;
  params?: Record<string, any>;
  errorStack?: string;
  additionalInfo?: Record<string, any>;
}

// Validação das configurações de log
function validateLogConfig(): void {
  const retention = process.env.LOG_RETENTION_DAYS
    ? parseInt(process.env.LOG_RETENTION_DAYS)
    : 30;

  if (isNaN(retention) || retention < 1) {
    throw new Error('LOG_RETENTION_DAYS deve ser um número positivo');
  }

  const maxSize = process.env.LOG_MAX_SIZE || '10m';
  const sizePattern = /^(\d+)(k|m|g)$/i;
  if (!sizePattern.test(maxSize)) {
    throw new Error(
      'LOG_MAX_SIZE deve seguir o padrão: número seguido de k, m ou g (ex: 10m)',
    );
  }

  const logDir = process.env.LOG_DIR || 'logs';
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch {
    throw new Error(
      `Não foi possível criar/acessar o diretório de logs: ${logDir}`,
    );
  }
}

// Executa validação na inicialização
validateLogConfig();

// Configurações de transporte baseadas no ambiente
const transportTargets: TransportTargetOptions[] = [];

// Configuração para desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  transportTargets.push({
    target: 'pino-pretty',
    level: 'debug',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{category}: {msg}',
      customPrettifiers: {
        category: (category: string) => `[${category}]`.padEnd(10),
      },
    },
  });
}

// Configurações de rotação e retenção de logs
const LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS
  ? parseInt(process.env.LOG_RETENTION_DAYS)
  : 30;
const LOG_DIR = process.env.LOG_DIR || 'logs';
const MAX_FILE_SIZE = process.env.LOG_MAX_SIZE || '10m';

// Configuração para produção com rotação avançada
if (process.env.NODE_ENV === 'production') {
  // Log principal da aplicação
  transportTargets.push({
    target: 'pino-roll',
    level: 'info',
    options: {
      file: `${LOG_DIR}/app.log`,
      frequency: 'daily',
      size: MAX_FILE_SIZE,
      mkdir: true,
      maxFiles: LOG_RETENTION_DAYS,
      compress: true,
      dateFormat: 'YYYY-MM-DD',
      syncTimeout: 0,
    },
  });

  // Log separado para erros
  transportTargets.push({
    target: 'pino-roll',
    level: 'error',
    options: {
      file: `${LOG_DIR}/error.log`,
      frequency: 'daily',
      size: MAX_FILE_SIZE,
      mkdir: true,
      maxFiles: LOG_RETENTION_DAYS,
      compress: true,
      dateFormat: 'YYYY-MM-DD',
      syncTimeout: 0,
    },
  });

  // Log separado para segurança
  transportTargets.push({
    target: 'pino-roll',
    level: 'warn',
    options: {
      file: `${LOG_DIR}/security.log`,
      frequency: 'daily',
      size: MAX_FILE_SIZE,
      mkdir: true,
      maxFiles: LOG_RETENTION_DAYS,
      compress: true,
      dateFormat: 'YYYY-MM-DD',
      syncTimeout: 0,
      customFormatter: (obj: Record<string, any>) => {
        if (
          obj.category === LogCategory.SECURITY ||
          obj.category === LogCategory.AUTH
        ) {
          return JSON.stringify(obj) + '\n';
        }
        return null;
      },
    },
  });

  // Log separado para performance
  transportTargets.push({
    target: 'pino-roll',
    level: 'info',
    options: {
      file: `${LOG_DIR}/performance.log`,
      frequency: 'daily',
      size: MAX_FILE_SIZE,
      mkdir: true,
      maxFiles: LOG_RETENTION_DAYS,
      compress: true,
      dateFormat: 'YYYY-MM-DD',
      customFormatter: (obj: Record<string, any>) => {
        if (obj.category === LogCategory.PERFORMANCE) {
          return JSON.stringify(obj) + '\n';
        }
        return null;
      },
    },
  });
}

const transport = pino.transport({
  targets: transportTargets,
});

const baseLogger = pino(
  {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: label => {
        return { level: label.toUpperCase() };
      },
    },
    base: {
      env: process.env.NODE_ENV,
      service: 'ebgeo-service',
    },
  },
  transport,
);

// Adiciona informação do caller (arquivo/linha)
const logger = pinoCaller(baseLogger);

// Interface estendida do logger para logging estruturado
interface StructuredLogger {
  logRequest: (req: any, details?: Partial<LogDetails>) => void;
  logResponse: (
    res: any,
    duration: number,
    details?: Partial<LogDetails>,
  ) => void;
  logError: (error: Error | string, details: LogDetails) => void;
  logMetric: (
    name: string,
    value: number,
    details: Partial<LogDetails>,
  ) => void;
  logAuth: (message: string, details: Partial<LogDetails>) => void;
  logSecurity: (message: string, details: Partial<LogDetails>) => void;
  logAccess: (message: string, details: Partial<LogDetails>) => void;
  logPerformance: (message: string, details: Partial<LogDetails>) => void;
}

const structuredLogger: StructuredLogger = {
  logRequest(req, details = {}) {
    logger.info({
      msg: 'Incoming request',
      category: LogCategory.API,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id,
      ...details,
    });
  },

  logResponse(res, duration, details = {}) {
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      msg: 'Request completed',
      category: LogCategory.API,
      statusCode: res.statusCode,
      duration,
      requestId: res.req.id,
      ...details,
    });
  },

  logError(error: Error | string, details: LogDetails) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error({
      msg: errorMessage,
      errorStack,
      ...details,
    });
  },

  logMetric(name: string, value: number, details: Partial<LogDetails>) {
    logger.info({
      msg: 'Metric recorded',
      category: LogCategory.PERFORMANCE,
      metric: name,
      value,
      ...details,
    });
  },

  logAuth(message: string, details: Partial<LogDetails>) {
    logger.info({
      msg: message,
      category: LogCategory.AUTH,
      ...details,
    });
  },

  logSecurity(message: string, details: Partial<LogDetails>) {
    logger.warn({
      msg: message,
      category: LogCategory.SECURITY,
      ...details,
    });
  },

  logAccess(message: string, details: Partial<LogDetails>) {
    logger.info({
      msg: message,
      category: LogCategory.ACCESS,
      ...details,
    });
  },

  logPerformance(message: string, details: Partial<LogDetails>) {
    logger.info({
      msg: message,
      category: LogCategory.PERFORMANCE,
      ...details,
    });
  },
};

export default { ...logger, ...structuredLogger };
