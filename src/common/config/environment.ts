import { HelmetOptions } from 'helmet';

export type Environment = 'development' | 'production' | 'test';

interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  useHttps: boolean;
  cookieConfig: {
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  corsConfig: {
    origin: string[] | string;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  dbConfig: {
    ssl: boolean | { rejectUnauthorized: boolean };
    maxConnections: number;
    idleTimeoutMillis: number;
  };
  helmetConfig: HelmetOptions;
}

export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private currentEnv: Environment;
  private config: EnvironmentConfig;

  private constructor() {
    this.currentEnv = (process.env.NODE_ENV as Environment) || 'development';
    this.config = this.buildConfig();
  }

  public static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  private buildHelmetConfig(isDevelopment: boolean): HelmetOptions {
    const commonConfig = {
      frameguard: {
        action: 'deny' as const,
      },
      noSniff: true,
      xssFilter: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    };

    if (isDevelopment) {
      return {
        ...commonConfig,
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: [
              "'self'",
              'ws:',
              'wss:',
              'http://localhost:*',
              'https://localhost:*',
            ],
            fontSrc: ["'self'", 'data:'],
          },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: false,
      };
    }

    // Configuração de produção
    return {
      ...commonConfig,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: 'same-origin' as const },
      crossOriginResourcePolicy: { policy: 'same-origin' as const },
      dnsPrefetchControl: { allow: false },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
    };
  }

  private buildConfig(): EnvironmentConfig {
    const isProduction = this.currentEnv === 'production';
    const isDevelopment = this.currentEnv === 'development';
    const isTest = this.currentEnv === 'test';

    return {
      isDevelopment,
      isProduction,
      isTest,
      useHttps: isProduction,
      cookieConfig: {
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
      },
      corsConfig: {
        origin:
          process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      },
      dbConfig: {
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        maxConnections: isProduction ? 20 : isDevelopment ? 10 : 5,
        idleTimeoutMillis: isProduction ? 30000 : isDevelopment ? 30000 : 10000,
      },
      helmetConfig: this.buildHelmetConfig(isDevelopment),
    };
  }

  public getEnvironment(): Environment {
    return this.currentEnv;
  }

  public isProduction(): boolean {
    return this.config.isProduction;
  }

  public isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  public isTest(): boolean {
    return this.config.isTest;
  }

  public useHttps(): boolean {
    return this.config.useHttps;
  }

  public getCookieConfig() {
    return this.config.cookieConfig;
  }

  public getCorsConfig() {
    return this.config.corsConfig;
  }

  public getDbConfig() {
    return this.config.dbConfig;
  }

  public getHelmetConfig() {
    return this.config.helmetConfig;
  }
}

export const envManager = EnvironmentManager.getInstance();
