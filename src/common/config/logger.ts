import { pino } from 'pino';
import { pinoCaller } from 'pino-caller';
import { TransportTargetOptions } from 'pino';

// Define the transport targets based on environment
const transportTargets: TransportTargetOptions[] = [];

// Add development console target
if (process.env.NODE_ENV !== 'production') {
  transportTargets.push({
    target: 'pino-pretty',
    level: 'debug',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  });
}

// Add production file target
if (process.env.NODE_ENV === 'production') {
  transportTargets.push({
    target: 'pino-roll',
    level: 'info',
    options: {
      file: 'logs/app.log',
      frequency: 'daily',
      size: '10m',
      mkdir: true,
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

// Interface para logging estruturado
interface StructuredLogger {
  request(req: any, msg?: string): void;
  response(res: any, duration: number, msg?: string): void;
  error(error: Error | string, context?: object): void;
  metric(name: string, value: number, tags?: object): void;
}

const structuredLogger: StructuredLogger = {
  request(req, msg = 'Incoming request') {
    logger.info({
      msg,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
  },

  response(res, duration, msg = 'Request completed') {
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      msg,
      statusCode: res.statusCode,
      duration,
      requestId: res.req.id,
    });
  },

  error(error: Error | string, context: object = {}) {
    if (typeof error === 'string') {
      logger.error({
        msg: error,
        ...context,
      });
    } else {
      logger.error({
        msg: error.message,
        error: {
          name: error.name,
          stack: error.stack,
          ...context,
        },
      });
    }
  },

  metric(name, value, tags = {}) {
    logger.info({
      msg: 'Metric',
      metric: name,
      value,
      tags,
    });
  },
};

export default { ...logger, ...structuredLogger };
