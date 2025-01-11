// database.ts
import pgPromise from 'pg-promise';
import { IInitOptions, IDatabase, IMain } from 'pg-promise';
import logger from './logger.js';
import { validateDBEnvVariables } from './envValidation.js';

// Validar variáveis de ambiente antes de configurar a conexão
validateDBEnvVariables();

const initOptions: IInitOptions = {
  error(error: any, e: any) {
    if (e.cn) {
      logger.error('Database connection error:', {
        error: error instanceof Error ? error : new Error(String(error)),
        connectionDetails: {
          host: e.cn.host,
          port: e.cn.port,
          database: e.cn.database,
        },
      });
    }
  },
  query(e: any) {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Query:', {
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    }
  },
  receive(data: any) {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Query results:', {
        rowCount: data.data?.length,
        // Acessando duration de forma segura
        duration: data.ctx?.query?.duration,
      });
    }
  },
};

const pgp: IMain = pgPromise(initOptions);

// Configuração do pool de conexões baseada no ambiente
const poolConfig = {
  development: {
    max: 10,
    idleTimeoutMillis: 30000,
  },
  production: {
    max: 20,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: false,
  },
  test: {
    max: 5,
    idleTimeoutMillis: 10000,
  },
};

const env = process.env.NODE_ENV || 'development';

const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ...poolConfig[env as keyof typeof poolConfig],
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  retry: {
    max: 3,
    interval: 1000,
  },
};

export const db: IDatabase<any> = pgp(config);

// Função para testar a conexão
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await db.one('SELECT 1');
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Database connection test failed:', { error });
    } else {
      logger.error('Database connection test failed with unknown error', {
        error,
      });
    }
    return false;
  }
}

// Função para encerrar a conexão
export async function closeDatabase(): Promise<void> {
  try {
    await pgp.end();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', { error });
    throw error;
  }
}
