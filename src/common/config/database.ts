import pgPromise from 'pg-promise';
import { IInitOptions, IDatabase, IMain } from 'pg-promise';
import logger, { LogCategory } from './logger.js';
import { envManager } from './environment.js';

const initOptions: IInitOptions = {
  error(error: any, e: any) {
    if (e.cn) {
      logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          category: LogCategory.DB,
          additionalInfo: {
            connectionDetails: {
              host: e.cn.host,
              port: e.cn.port,
              database: e.cn.database,
            },
          },
        },
      );
    }
  },
  query(e: any) {
    if (envManager.isDevelopment()) {
      logger.logPerformance('Query execution', {
        category: LogCategory.DB,
        duration: e.duration,
        additionalInfo: {
          query: e.query,
          params: e.params,
        },
      });
    }
  },
  receive(data: any) {
    if (envManager.isDevelopment()) {
      logger.logPerformance('Query results received', {
        category: LogCategory.DB,
        duration: data.ctx?.query?.duration,
        additionalInfo: {
          rowCount: data.data?.length,
        },
      });
    }
  },
};

const pgp: IMain = pgPromise(initOptions);
let db: IDatabase<any>;

export const initializeDatabase = () => {
  if (db) {
    return db; // Retorna instância existente se já foi inicializada
  }

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

  db = pgp(config);
  return db;
};

export { db };

// Função para testar a conexão
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const database = initializeDatabase();
    await database.one('SELECT 1');
    logger.logAccess('Database connection successful', {
      category: LogCategory.DB,
      additionalInfo: {
        environment: envManager.getEnvironment(),
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
      },
    });
    return true;
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.DB,
      additionalInfo: {
        operation: 'connection_test',
      },
    });
    return false;
  }
}

// Função para encerrar a conexão
export async function closeDatabase(): Promise<void> {
  try {
    await pgp.end();
    logger.logAccess('Database connection closed', {
      category: LogCategory.DB,
      additionalInfo: {
        environment: envManager.getEnvironment(),
      },
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.DB,
      additionalInfo: {
        operation: 'connection_close',
        environment: envManager.getEnvironment(),
      },
    });
    throw error;
  }
}
