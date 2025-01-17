// src/common/config/envValidation.ts
import os from 'os';
import { Environment } from './environment.js';

interface ValidationError {
  variable: string;
  message: string;
  context: string;
}

class EnvValidationError extends Error {
  errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const errorsByContext = errors.reduce(
      (acc: { [key: string]: string[] }, error) => {
        if (!acc[error.context]) {
          acc[error.context] = [];
        }
        acc[error.context].push(`${error.variable}: ${error.message}`);
        return acc;
      },
      {},
    );

    const message = Object.entries(errorsByContext)
      .map(([context, errors]) => `${context}:\n  - ${errors.join('\n  - ')}`)
      .join('\n');

    super(`Environment validation failed:\n${message}`);
    this.name = 'EnvValidationError';
    this.errors = errors;
  }
}

// Funções utilitárias de validação
const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const validatePort = (port: string | undefined): boolean => {
  if (!port) return false;
  const portNum = parseInt(port, 10);
  return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
};

const validateSecretLength = (
  secret: string | undefined,
  minLength: number,
): boolean => {
  return !!secret && secret.length >= minLength;
};

const validateLogRetention = (days: string | undefined): boolean => {
  if (!days) return true; // Opcional, usa valor padrão
  const daysNum = parseInt(days, 10);
  return !isNaN(daysNum) && daysNum > 0 && daysNum <= 365;
};

const validateLogSize = (size: string | undefined): boolean => {
  if (!size) return true; // Opcional, usa valor padrão
  const sizePattern = /^(\d+)(k|m|g)$/i;
  if (!sizePattern.test(size)) return false;

  const [, value, unit] = size.match(sizePattern) || [];
  const sizeNum = parseInt(value, 10);

  switch (unit.toLowerCase()) {
    case 'k':
      return sizeNum <= 1024 * 1024; // Max 1GB em KB
    case 'm':
      return sizeNum <= 1024; // Max 1GB em MB
    case 'g':
      return sizeNum <= 1; // Max 1GB
    default:
      return false;
  }
};

// Coletor de erros - usado internamente pelas funções de validação
const errors: ValidationError[] = [];

// Funções de validação por contexto
const validateLogging = (): void => {
  const context = 'Logging Configuration';

  if (process.env.LOG_RETENTION_DAYS) {
    if (!validateLogRetention(process.env.LOG_RETENTION_DAYS)) {
      errors.push({
        context,
        variable: 'LOG_RETENTION_DAYS',
        message: 'Deve ser um número entre 1 e 365',
      });
    }
  }

  if (process.env.LOG_MAX_SIZE) {
    if (!validateLogSize(process.env.LOG_MAX_SIZE)) {
      errors.push({
        context,
        variable: 'LOG_MAX_SIZE',
        message:
          'Deve seguir o formato: número seguido de k, m ou g (ex: 10m) e não exceder 1GB',
      });
    }
  }

  if (process.env.LOG_DIR) {
    // Verificar se o caminho não contém caracteres inválidos
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(process.env.LOG_DIR)) {
      errors.push({
        context,
        variable: 'LOG_DIR',
        message: 'Caminho contém caracteres inválidos',
      });
    }
  }
};

const validateDatabase = (): void => {
  const context = 'Database Configuration';

  ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].forEach(
    varName => {
      if (!process.env[varName]) {
        errors.push({
          context,
          variable: varName,
          message: 'Required variable is missing',
        });
      }
    },
  );

  if (process.env.DB_PORT && !validatePort(process.env.DB_PORT)) {
    errors.push({
      context,
      variable: 'DB_PORT',
      message: 'Must be a valid port number (1-65535)',
    });
  }
};

const validateAuthentication = (): void => {
  const context = 'Authentication Configuration';
  const MIN_SECRET_LENGTH = 32;

  ['JWT_SECRET', 'PASSWORD_PEPPER'].forEach(varName => {
    if (!process.env[varName]) {
      errors.push({
        context,
        variable: varName,
        message: 'Required variable is missing',
      });
    } else if (!validateSecretLength(process.env[varName], MIN_SECRET_LENGTH)) {
      errors.push({
        context,
        variable: varName,
        message: `Must be at least ${MIN_SECRET_LENGTH} characters long`,
      });
    }
  });
};

const validateSecurity = (environment: Environment): void => {
  const context = 'Security Configuration';

  if (environment === 'production') {
    ['SSL_KEY_PATH', 'SSL_CERT_PATH'].forEach(varName => {
      if (!process.env[varName]) {
        errors.push({
          context,
          variable: varName,
          message: 'Required in production environment',
        });
      }
    });
  }

  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',');
    origins.forEach((origin, index) => {
      if (!validateUrl(origin)) {
        errors.push({
          context,
          variable: 'ALLOWED_ORIGINS',
          message: `Invalid URL at position ${index + 1}: ${origin}`,
        });
      }
    });
  }
};

const validateRateLimit = (): void => {
  const context = 'Rate Limiting Configuration';

  if (process.env.RATE_LIMIT_WINDOW_MS) {
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10);
    if (isNaN(windowMs) || windowMs <= 0) {
      errors.push({
        context,
        variable: 'RATE_LIMIT_WINDOW_MS',
        message: 'Must be a positive number',
      });
    }
  }

  if (process.env.RATE_LIMIT_MAX_REQUESTS) {
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10);
    if (isNaN(maxRequests) || maxRequests <= 0) {
      errors.push({
        context,
        variable: 'RATE_LIMIT_MAX_REQUESTS',
        message: 'Must be a positive number',
      });
    }
  }
};

const validateGeneral = (): void => {
  const context = 'General Configuration';

  if (!validatePort(process.env.PORT)) {
    errors.push({
      context,
      variable: 'PORT',
      message: 'Must be a valid port number (1-65535)',
    });
  }

  const validEnvironments: Environment[] = [
    'development',
    'production',
    'test',
  ];
  if (
    process.env.NODE_ENV &&
    !validEnvironments.includes(process.env.NODE_ENV as Environment)
  ) {
    errors.push({
      context,
      variable: 'NODE_ENV',
      message: 'Must be one of: development, production, test',
    });
  }

  if (process.env.MAX_WORKERS) {
    const maxWorkers = parseInt(process.env.MAX_WORKERS, 10);
    const numCPUs = os.cpus().length;

    if (isNaN(maxWorkers) || maxWorkers <= 0) {
      errors.push({
        context,
        variable: 'MAX_WORKERS',
        message: 'Must be a positive number',
      });
    } else if (maxWorkers > numCPUs) {
      errors.push({
        context,
        variable: 'MAX_WORKERS',
        message: `Cannot exceed number of available CPUs (${numCPUs})`,
      });
    }
  }
};

// Função principal de validação
export function validateEnvVariables(): void {
  // Limpar erros anteriores
  errors.length = 0;

  const environment = (process.env.NODE_ENV as Environment) || 'development';

  // Executar todas as validações
  validateGeneral();
  validateDatabase();
  validateAuthentication();
  validateSecurity(environment);
  validateRateLimit();
  validateLogging();

  // Se houver erros, lançar exceção com todos eles
  if (errors.length > 0) {
    throw new EnvValidationError(errors);
  }
}

// Exportar também as funções individuais para casos específicos
export const validators = {
  validateDatabase,
  validateAuthentication,
  validateSecurity,
  validateRateLimit,
  validateGeneral,
  validateLogging,
};
