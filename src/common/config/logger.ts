import {
  pino,
  LoggerOptions,
  Logger,
  DestinationStream,
  multistream,
} from 'pino';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pinoCaller = require('pino-caller');
const pretty = require('pino-pretty');
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

interface CategoryConfig {
  level: string;
  streams: { stream: DestinationStream; level: string }[];
}

type CategoryLoggers = {
  [K in LogCategory]: Logger;
};

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

if (process.env.NODE_ENV !== 'test') {
  validateLogConfig();
}

const LOG_DIR = process.env.LOG_DIR || 'logs';

// Stream formatado para console
const prettyStream = pretty({
  colorize: true,
  translateTime: 'SYS:standard',
  ignore: 'pid,hostname',
});

// Configuração para cada categoria
const categoryConfigs: Record<LogCategory, CategoryConfig> = Object.values(
  LogCategory,
).reduce(
  (acc, category) => {
    const filePath = `${LOG_DIR}/${category.toLowerCase()}.log`;
    const fileStream = pino.destination(filePath);

    const streams: { stream: DestinationStream; level: string }[] = [
      { stream: fileStream, level: 'info' },
    ];

    // Adicionar console stream para ADMIN e SYSTEM em desenvolvimento
    if (
      process.env.NODE_ENV === 'development' &&
      (category === LogCategory.ADMIN || category === LogCategory.SYSTEM)
    ) {
      streams.push({ stream: prettyStream, level: 'info' });
    }

    return {
      ...acc,
      [category]: {
        level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
        streams,
      },
    };
  },
  {} as Record<LogCategory, CategoryConfig>,
);

// Configuração do logger principal
const loggerConfig: LoggerOptions = {
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  base: {
    env: process.env.NODE_ENV,
    service: 'ebgeo-service',
  },
};

// Criar um logger para cada categoria
const loggers: CategoryLoggers = Object.entries(categoryConfigs).reduce(
  (acc, [category, config]) => {
    return {
      ...acc,
      [category as LogCategory]: pino(
        {
          ...loggerConfig,
          level: config.level,
        },
        multistream(config.streams),
      ),
    };
  },
  {} as CategoryLoggers,
);

// Logger base
const baseLogger = pino(loggerConfig);
const logger = pinoCaller(baseLogger);

// Interface estendida do logger para logging estruturado
const structuredLogger = {
  logError(error: Error | string, details: LogDetails) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const err = new Error();
    Error.captureStackTrace(err, this.logError);
    const callerStack = err.stack?.split('\n')[1];

    const categoryLogger = loggers[details.category];
    if (categoryLogger) {
      categoryLogger.error({
        msg: errorMessage,
        errorStack,
        callerStack,
        ...details,
      });
    }

    // Também loga no logger principal
    logger.error({
      msg: errorMessage,
      errorStack,
      callerStack,
      ...details,
    });
  },

  logMetric(name: string, value: number, details: Partial<LogDetails>) {
    if (process.env.NODE_ENV === 'test') return;

    if (details.path && shouldIgnorePath(details.path)) {
      return;
    }

    const categoryLogger = loggers[LogCategory.PERFORMANCE];
    if (categoryLogger) {
      categoryLogger.info({
        msg: 'Metric recorded',
        metric: name,
        value,
        ...details,
      });
    }
  },

  logAuth(message: string, details: Partial<LogDetails>) {
    const categoryLogger = loggers[LogCategory.AUTH];
    if (categoryLogger) {
      categoryLogger.info({
        msg: message,
        ...details,
      });
    }
  },

  logSecurity(message: string, details: Partial<LogDetails>) {
    const categoryLogger = loggers[LogCategory.SECURITY];
    if (categoryLogger) {
      categoryLogger.warn({
        msg: message,
        ...details,
      });
    }
  },

  logAccess(message: string, details: Partial<LogDetails>) {
    if (
      details.additionalInfo?.path &&
      shouldIgnorePath(details.additionalInfo.path)
    ) {
      return;
    }

    const categoryLogger = loggers[LogCategory.ACCESS];
    if (categoryLogger) {
      categoryLogger.info({
        msg: message,
        ...details,
      });
    }
  },

  logPerformance(message: string, details: Partial<LogDetails>) {
    if (process.env.NODE_ENV === 'test') return;

    if (details.path && shouldIgnorePath(details.path)) {
      return;
    }

    const categoryLogger = loggers[LogCategory.PERFORMANCE];
    if (categoryLogger) {
      categoryLogger.info({
        msg: message,
        ...details,
      });
    }
  },
};

export default { ...logger, ...structuredLogger };
