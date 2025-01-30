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

type CategoryLoggers = {
  [K in LogCategory]: Logger;
};

class LoggerService {
  private static instance: LoggerService;
  private loggers: CategoryLoggers;
  private baseLogger: Logger;
  private initialized: boolean = false;
  private streams: Record<string, DestinationStream> = {};

  private constructor() {
    this.loggers = {} as CategoryLoggers;
    this.baseLogger = pino();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private async validateLogConfig(): Promise<void> {
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
        await fs.promises.mkdir(logDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(
        `Não foi possível criar/acessar o diretório de logs: ${logDir}: ${error}`,
      );
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    if (process.env.NODE_ENV !== 'test') {
      await this.validateLogConfig();
    }

    const LOG_DIR = process.env.LOG_DIR || 'logs';

    // Configuração base
    const loggerConfig: LoggerOptions = {
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      base: {
        env: process.env.NODE_ENV,
        service: 'ebgeo-service',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    // Stream formatado para console
    const prettyStream = pretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      sync: true,
    });

    // Inicializar streams para cada categoria
    for (const category of Object.values(LogCategory)) {
      const filePath = `${LOG_DIR}/${category.toLowerCase()}.log`;
      const fileStream = pino.destination({
        dest: filePath,
        sync: true,
        mkdir: true,
      });

      this.streams[category] = fileStream;

      const streams: { stream: DestinationStream; level: string }[] = [
        { stream: fileStream, level: 'info' },
      ];

      if (
        process.env.NODE_ENV === 'development' &&
        (category === LogCategory.ADMIN || category === LogCategory.SYSTEM)
      ) {
        streams.push({ stream: prettyStream, level: 'info' });
      }

      this.loggers[category] = pino(
        {
          ...loggerConfig,
          level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
        },
        multistream(streams),
      );
    }

    this.baseLogger = pinoCaller(pino(loggerConfig));
    this.initialized = true;
  }

  public async close(): Promise<void> {
    if (!this.initialized) return;

    // Fechar todos os streams
    const closePromises = Object.values(this.streams).map(stream => {
      return new Promise<void>(resolve => {
        if ('flushSync' in stream) {
          try {
            (stream as any).flushSync();
          } catch {
            // Ignorar erros de flush
          }
        }
        // Verificar se o stream tem o método end com a tipagem correta
        const hasEndMethod = (
          s: any,
        ): s is { end: (cb: () => void) => void } => {
          return typeof s?.end === 'function';
        };

        if (hasEndMethod(stream)) {
          stream.end(() => resolve());
        } else {
          resolve();
        }
      });
    });

    await Promise.all(closePromises);
    this.initialized = false;
  }

  public logError(error: Error | string, details: LogDetails): void {
    if (!this.initialized) return;

    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const err = new Error();
    Error.captureStackTrace(err, this.logError);
    const callerStack = err.stack?.split('\n')[1];

    const categoryLogger = this.loggers[details.category];

    if (categoryLogger) {
      categoryLogger.error({
        msg: errorMessage,
        errorStack,
        callerStack,
        ...details,
      });
    }

    this.baseLogger.error({
      msg: errorMessage,
      errorStack,
      callerStack,
      ...details,
    });
  }

  public logMetric(
    name: string,
    value: number,
    details: Partial<LogDetails>,
  ): void {
    if (!this.initialized) return;

    if (details.path && shouldIgnorePath(details.path)) {
      return;
    }

    const categoryLogger = this.loggers[LogCategory.PERFORMANCE];
    if (categoryLogger) {
      categoryLogger.info({
        msg: 'Metric recorded',
        metric: name,
        value,
        category: LogCategory.PERFORMANCE,
        ...details,
      });
    }
  }

  public logAuth(message: string, details: Partial<LogDetails>): void {
    if (!this.initialized) return;

    const categoryLogger = this.loggers[LogCategory.AUTH];
    if (categoryLogger) {
      categoryLogger.info({
        msg: message,
        category: LogCategory.AUTH,
        ...details,
      });
    }
  }

  public logSecurity(message: string, details: Partial<LogDetails>): void {
    if (!this.initialized) return;

    const categoryLogger = this.loggers[LogCategory.SECURITY];
    if (categoryLogger) {
      categoryLogger.warn({
        msg: message,
        category: LogCategory.SECURITY,
        ...details,
      });
    }
  }

  public logAccess(message: string, details: Partial<LogDetails>): void {
    if (!this.initialized) return;

    if (
      details.additionalInfo?.path &&
      shouldIgnorePath(details.additionalInfo.path)
    ) {
      return;
    }

    const categoryLogger = this.loggers[LogCategory.ACCESS];
    if (categoryLogger) {
      categoryLogger.info({
        msg: message,
        category: LogCategory.ACCESS,
        ...details,
      });
    }
  }

  public logPerformance(message: string, details: Partial<LogDetails>): void {
    if (details.path && shouldIgnorePath(details.path)) {
      return;
    }

    const categoryLogger = this.loggers[LogCategory.PERFORMANCE];
    if (categoryLogger) {
      categoryLogger.info({
        msg: message,
        category: LogCategory.PERFORMANCE,
        ...details,
      });
    }
  }

  public getBaseLogger(): Logger {
    return this.baseLogger;
  }
}

// Criar instância única
const loggerService = LoggerService.getInstance();

// Exportar interface pública
export default {
  ...loggerService.getBaseLogger(),
  init: () => loggerService.init(),
  close: () => loggerService.close(),
  logError: (error: Error | string, details: LogDetails) =>
    loggerService.logError(error, details),
  logMetric: (name: string, value: number, details: Partial<LogDetails>) =>
    loggerService.logMetric(name, value, details),
  logAuth: (message: string, details: Partial<LogDetails>) =>
    loggerService.logAuth(message, details),
  logSecurity: (message: string, details: Partial<LogDetails>) =>
    loggerService.logSecurity(message, details),
  logAccess: (message: string, details: Partial<LogDetails>) =>
    loggerService.logAccess(message, details),
  logPerformance: (message: string, details: Partial<LogDetails>) =>
    loggerService.logPerformance(message, details),
};
