import cluster from 'cluster';
import os from 'os';
import https from 'https';
import http from 'http';
import fs from 'fs';
import app from './app.js';
import logger, { LogCategory } from './common/config/logger.js';
import {
  db,
  initializeDatabase,
  testDatabaseConnection,
} from './common/config/database.js';
import { validateEnvVariables } from './common/config/envValidation.js';
import { envManager } from './common/config/environment.js';

await logger.init();

const numCPUs = os.cpus().length;
const MAX_WORKERS = process.env.MAX_WORKERS
  ? parseInt(process.env.MAX_WORKERS)
  : 8;
const numWorkers = Math.min(Math.floor(numCPUs / 3), MAX_WORKERS);
const PORT = process.env.PORT || 3000;

// Track server metrics
const startTime = Date.now();

async function createServer() {
  if (envManager.useHttps()) {
    const httpsOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH || ''),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || ''),
    };
    return https.createServer(httpsOptions, app);
  }
  return http.createServer(app);
}

async function startServer() {
  try {
    // Validação das variáveis de ambiente
    validateEnvVariables();
    logger.logAccess('Environment validation successful', {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        pid: process.pid,
        environment: envManager.getEnvironment(),
      },
    });

    // Inicializar banco
    initializeDatabase();

    // Testar conexão com banco
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    const server = await createServer();

    await new Promise((resolve, reject) => {
      server.listen(PORT, () => {
        logger.logAccess('Server started successfully', {
          category: LogCategory.SYSTEM,
          additionalInfo: {
            pid: process.pid,
            port: PORT,
            protocol: envManager.useHttps() ? 'https' : 'http',
          },
        });
        resolve(true);
      });

      server.on('error', error => {
        reject(error);
      });
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.logAccess('Shutdown initiated', {
        category: LogCategory.SYSTEM,
        additionalInfo: {
          pid: process.pid,
          signal,
          timestamp: new Date().toISOString(),
        },
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      await logger.close();

      server.close(async () => {
        try {
          await db.$pool.end();
          logger.logAccess('Clean shutdown completed', {
            category: LogCategory.SYSTEM,
            additionalInfo: {
              pid: process.pid,
              uptime: Date.now() - startTime,
            },
          });
          process.exit(0);
        } catch (error) {
          logger.logError(
            error instanceof Error ? error : new Error(String(error)),
            {
              category: LogCategory.SYSTEM,
              additionalInfo: {
                stage: 'shutdown',
                pid: process.pid,
              },
            },
          );
          process.exit(1);
        }
      });

      // Força o encerramento após 30 segundos
      setTimeout(() => {
        logger.logError(new Error('Forced shutdown due to timeout'), {
          category: LogCategory.SYSTEM,
          additionalInfo: {
            pid: process.pid,
            shutdownType: 'forced',
          },
        });
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        stage: 'startup',
        pid: process.pid,
      },
    });
    // Propaga o erro para ser tratado pelo cluster
    throw error;
  }
}

function initializeWorker() {
  startServer().catch(error => {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        stage: 'worker_initialization',
        pid: process.pid,
      },
    });
    process.exit(1);
  });
}

async function initializePrimaryProcess() {
  try {
    logger.logAccess('Primary process starting', {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        pid: process.pid,
        workers: numWorkers,
      },
    });

    // O processo primário não inicia o servidor, apenas gerencia os workers

    // Inicializa os workers
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }

    cluster.on('fork', worker => {
      logger.logAccess('Worker forked', {
        category: LogCategory.SYSTEM,
        additionalInfo: {
          workerPid: worker.process.pid,
          primaryPid: process.pid,
        },
      });
    });

    cluster.on('exit', (worker, code, signal) => {
      const logDetails = {
        category: LogCategory.SYSTEM,
        additionalInfo: {
          workerPid: worker.process.pid,
          primaryPid: process.pid,
          exitCode: code,
          signal,
        },
      };

      if (signal) {
        logger.logAccess(`Worker terminated by signal: ${signal}`, logDetails);
      } else if (code !== 0) {
        logger.logError(
          new Error(`Worker exited with code: ${code}`),
          logDetails,
        );
      } else {
        logger.logAccess('Worker exited cleanly', logDetails);
      }
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        stage: 'primary_initialization',
        pid: process.pid,
      },
    });
    process.exit(1);
  }
}

// Main execution
if (cluster.isPrimary) {
  // Validar ambiente antes de iniciar os workers
  validateEnvVariables();

  initializePrimaryProcess().catch(error => {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        stage: 'primary_process',
        pid: process.pid,
      },
    });
    process.exit(1);
  });
} else {
  // Apenas os workers iniciam o servidor
  initializeWorker();
}
