import { pino, LoggerOptions } from 'pino';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pinoCaller = require('pino-caller');
import fs from 'fs';

export const IGNORED_PATHS = [
  /\.(ico|png|jpg|jpeg|gif|svg|css|js|map)$/i,
  /^\/favicon/,
  /^\/static/,
  /^\/assets/,
  /^\/_next/,
  /^\/api-docs.*\.(png|ico)$/,
];

export const shouldIgnorePath = (path: string): boolean => {
  return IGNORED_PATHS.some(pattern => pattern.test(path));
};

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

// Configuração do logger
const LOG_DIR = process.env.LOG_DIR || 'logs';

const developmentConfig: LoggerOptions = {
  level: 'debug',
  base: {
    env: process.env.NODE_ENV,
    service: 'ebgeo-service',
  },
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: `${LOG_DIR}/app.log`,
          // ...
        },
      },
    ],
  },
};

const productionConfig: LoggerOptions = {
  level: 'info',
  base: {
    env: process.env.NODE_ENV,
    service: 'ebgeo-service',
  },
  transport: {
    targets: [
      // Log principal
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: `${LOG_DIR}/app.log`,
          frequency: 'daily',
          size: process.env.LOG_MAX_SIZE || '10m',
          mkdir: true,
          maxFiles: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
          compress: true,
        },
      },
      // Logs de erro
      {
        target: 'pino-roll',
        level: 'error',
        options: {
          file: `${LOG_DIR}/error.log`,
          frequency: 'daily',
          size: process.env.LOG_MAX_SIZE || '10m',
          mkdir: true,
          maxFiles: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
          compress: true,
        },
      },
      // Logs de autenticação
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: `${LOG_DIR}/auth.log`,
          frequency: 'daily',
          size: process.env.LOG_MAX_SIZE || '10m',
          mkdir: true,
          maxFiles: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
          compress: true,
          filter: (obj: any) => obj.category === LogCategory.AUTH,
        },
      },
      // Logs de segurança
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: `${LOG_DIR}/security.log`,
          frequency: 'daily',
          size: process.env.LOG_MAX_SIZE || '10m',
          mkdir: true,
          maxFiles: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
          compress: true,
          filter: (obj: any) => obj.category === LogCategory.SECURITY,
        },
      },
      // Logs de performance
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: `${LOG_DIR}/performance.log`,
          frequency: 'daily',
          size: process.env.LOG_MAX_SIZE || '10m',
          mkdir: true,
          maxFiles: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
          compress: true,
          filter: (obj: any) => obj.category === LogCategory.PERFORMANCE,
        },
      },
      // Logs de banco de dados
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: `${LOG_DIR}/db.log`,
          frequency: 'daily',
          size: process.env.LOG_MAX_SIZE || '10m',
          mkdir: true,
          maxFiles: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
          compress: true,
          filter: (obj: any) => obj.category === LogCategory.DB,
        },
      },
      // Logs de API
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: `${LOG_DIR}/api.log`,
          frequency: 'daily',
          size: process.env.LOG_MAX_SIZE || '10m',
          mkdir: true,
          maxFiles: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
          compress: true,
          filter: (obj: any) => obj.category === LogCategory.API,
        },
      },
      // Logs de acesso
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: `${LOG_DIR}/access.log`,
          frequency: 'daily',
          size: process.env.LOG_MAX_SIZE || '10m',
          mkdir: true,
          maxFiles: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
          compress: true,
          filter: (obj: any) => obj.category === LogCategory.ACCESS,
        },
      },
    ],
  },
};

// Criar o logger base com a configuração apropriada
const baseLogger = pino(
  process.env.NODE_ENV === 'production' ? productionConfig : developmentConfig,
);

// Adicionar informação do caller
const logger = pinoCaller(baseLogger);

// Interface estendida do logger para logging estruturado
interface StructuredLogger {
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
    if (details.path && shouldIgnorePath(details.path)) {
      return;
    }
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
    if (
      details.additionalInfo &&
      details.additionalInfo.path &&
      shouldIgnorePath(details.additionalInfo.path)
    ) {
      return;
    }
    logger.info({
      msg: message,
      category: LogCategory.ACCESS,
      ...details,
    });
  },

  logPerformance(message: string, details: Partial<LogDetails>) {
    if (details.path && shouldIgnorePath(details.path)) {
      return;
    }
    logger.info({
      msg: message,
      category: LogCategory.PERFORMANCE,
      ...details,
    });
  },
};

export default { ...logger, ...structuredLogger };
