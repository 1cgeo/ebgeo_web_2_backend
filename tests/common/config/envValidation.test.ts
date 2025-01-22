import { validateEnvVariables, validators } from '../../../src/common/config/envValidation';

describe('Environment Variables Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateEnvVariables', () => {
    it('should validate successfully with all required variables', () => {
      process.env = {
        NODE_ENV: 'development',
        PORT: '3000',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'test_db',
        DB_USER: 'user',
        DB_PASSWORD: 'password',
        JWT_SECRET: 'a'.repeat(32),
        PASSWORD_PEPPER: 'b'.repeat(32),
        ALLOWED_ORIGINS: 'http://localhost:3000',
        LOG_DIR: 'logs',
      };

      expect(() => validateEnvVariables()).not.toThrow();
    });

    it('should throw error for missing required variables', () => {
      process.env = {};
      
      expect(() => validateEnvVariables()).toThrow('Environment validation failed');
    });
  });

  describe('validateDatabase', () => {
    it('should validate correct database configuration', () => {
      process.env = {
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'test_db',
        DB_USER: 'user',
        DB_PASSWORD: 'password',
      };

      expect(() => validators.validateDatabase()).not.toThrow();
    });

    it('should catch invalid DB_PORT', () => {
      process.env = {
        DB_HOST: 'localhost',
        DB_PORT: '999999', // Invalid port
        DB_NAME: 'test_db',
        DB_USER: 'user',
        DB_PASSWORD: 'password',
      };

      expect(() => validateEnvVariables()).toThrow(/Must be a valid port number/);
    });
  });

  describe('validateAuthentication', () => {
    it('should validate correct authentication secrets', () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PASSWORD_PEPPER = 'b'.repeat(32);

      expect(() => validators.validateAuthentication()).not.toThrow();
    });

    it('should throw for short secrets', () => {
      process.env.JWT_SECRET = 'short';
      process.env.PASSWORD_PEPPER = 'alsoshort';

      expect(() => validateEnvVariables()).toThrow(/Must be at least 32 characters/);
    });
  });

  describe('validateSecurity', () => {
    it('should validate SSL configs in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.SSL_KEY_PATH = '/path/to/key.pem';
      process.env.SSL_CERT_PATH = '/path/to/cert.pem';

      expect(() => validators.validateSecurity('production')).not.toThrow();
    });

    it('should validate ALLOWED_ORIGINS', () => {
      process.env.ALLOWED_ORIGINS = 'http://invalid,not-a-url';

      expect(() => validateEnvVariables()).toThrow(/Invalid URL/);
    });
  });

  describe('validateRateLimit', () => {
    it('should validate correct rate limit values', () => {
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX_REQUESTS = '100';

      expect(() => validators.validateRateLimit()).not.toThrow();
    });

    it('should catch invalid rate limit values', () => {
      process.env.RATE_LIMIT_WINDOW_MS = '-1';
      process.env.RATE_LIMIT_MAX_REQUESTS = '0';

      expect(() => validateEnvVariables()).toThrow(/Must be a positive number/);
    });
  });

  describe('validateLogging', () => {
    it('should validate correct logging configuration', () => {
      process.env.LOG_RETENTION_DAYS = '30';
      process.env.LOG_MAX_SIZE = '10m';
      process.env.LOG_DIR = 'logs';

      expect(() => validators.validateLogging()).not.toThrow();
    });

    it('should catch invalid log retention days', () => {
      process.env.LOG_RETENTION_DAYS = '999';

      expect(() => validateEnvVariables()).toThrow(/entre 1 e 365/);
    });

    it('should catch invalid log size format', () => {
      process.env.LOG_MAX_SIZE = '999tb';

      expect(() => validateEnvVariables()).toThrow(/formato/);
    });

    it('should catch invalid log directory characters', () => {
      process.env.LOG_DIR = 'logs/test:*';

      expect(() => validateEnvVariables()).toThrow(/caracteres inválidos/);
    });
  });
});