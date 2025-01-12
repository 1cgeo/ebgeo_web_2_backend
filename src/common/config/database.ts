import pgPromise from 'pg-promise';
import { IInitOptions, IDatabase, IMain } from 'pg-promise';
import logger from './logger.js';
import { envManager } from './environment.js';

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
    if (envManager.isDevelopment()) {
      logger.debug('Query:', {
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    }
  },
  receive(data: any) {
    if (envManager.isDevelopment()) {
      logger.debug('Query results:', {
        rowCount: data.data?.length,
        duration: data.ctx?.query?.duration,
      });
    }
  },
};

const pgp: IMain = pgPromise(initOptions);

// Obter configurações de banco de dados baseadas no ambiente
const dbConfig = envManager.getDbConfig();

const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: dbConfig.maxConnections,
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  ssl: dbConfig.ssl,
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
    logger.info('Database connection successful', {
      environment: envManager.getEnvironment(),
      host: config.host,
      database: config.database,
    });
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
