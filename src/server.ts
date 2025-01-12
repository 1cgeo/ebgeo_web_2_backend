// src/server.ts
import cluster from 'cluster';
import os from 'os';
import https from 'https';
import http from 'http';
import fs from 'fs';
import app from './app.js';
import logger, { LogCategory } from './common/config/logger.js';
import { db, testDatabaseConnection } from './common/config/database.js';
import { validateEnvVariables } from './common/config/envValidation.js';
import { envManager } from './common/config/environment.js';

const numCPUs = os.cpus().length;
const MAX_WORKERS = process.env.MAX_WORKERS
  ? parseInt(process.env.MAX_WORKERS)
  : 8;
const numWorkers = Math.min(Math.floor(numCPUs / 3), MAX_WORKERS);
const PORT = process.env.PORT || 3000;

// Track server metrics
const startTime = Date.now();

async function startServer() {
  try {
    // Validação única e centralizada de todas as variáveis de ambiente
    validateEnvVariables();
    logger.logAccess('System initialization', {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        status: 'environment_validated',
      },
    });

    // Testar conexão com banco
    await testDatabaseConnection();

    let server;

    if (envManager.useHttps()) {
      const httpsOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH || ''),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH || ''),
      };
      server = https.createServer(httpsOptions, app);
    } else {
      server = http.createServer(app);
    }
    logger.logAccess('Server starting', {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        mode: envManager.useHttps() ? 'HTTPS' : 'HTTP',
        environment: envManager.getEnvironment(),
      },
    });

    server.listen(PORT, () => {
      logger.logAccess('Service started', {
        category: LogCategory.SYSTEM,
        additionalInfo: {
          pid: process.pid,
          port: PORT,
          environment: envManager.getEnvironment(),
          protocol: envManager.useHttps() ? 'https' : 'http',
        },
      });
    });

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.logAccess('Shutdown sequence initiated', {
        category: LogCategory.SYSTEM,
        additionalInfo: {
          trigger: 'manual',
          timestamp: new Date().toISOString(),
        },
      });

      server.close(async () => {
        logger.logAccess('Server shutdown initiated', {
          category: LogCategory.SYSTEM,
          additionalInfo: {
            stage: 'http_server_closed',
          },
        });

        try {
          await db.$pool.end();
          logger.logAccess('Database shutdown completed', {
            category: LogCategory.SYSTEM,
            additionalInfo: {
              stage: 'database_connections_closed',
            },
          });

          const uptime = Date.now() - startTime;
          logger.logAccess('Server shutdown completed', {
            category: LogCategory.SYSTEM,
            additionalInfo: {
              uptime,
              shutdownType: 'graceful',
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
                operation: 'shutdown_procedure',
              },
            },
          );
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.logError(new Error('Force shutdown due to timeout'), {
          category: LogCategory.SYSTEM,
          additionalInfo: {
            stage: 'shutdown',
            shutdownType: 'forced',
          },
        });
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        stage: 'startup',
        operation: 'server_initialization',
      },
    });
    process.exit(1);
  }
}

// Initialize primary process
async function initializePrimaryProcess() {
  try {
    // Start server for primary process
    await startServer();

    // Fork workers
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }

    // Enhanced cluster event handling
    cluster.on('fork', worker => {
      logger.logAccess('Worker forked', {
        category: LogCategory.SYSTEM,
        additionalInfo: {
          pid: worker.process.pid,
          status: 'created',
        },
      });
    });

    cluster.on('online', worker => {
      logger.logAccess('Worker online', {
        category: LogCategory.SYSTEM,
        additionalInfo: {
          pid: worker.process.pid,
          status: 'online',
        },
      });
    });

    cluster.on('exit', (worker, code, signal) => {
      if (signal) {
        logger.logError(new Error(`Worker killed by signal: ${signal}`), {
          category: LogCategory.SYSTEM,
          additionalInfo: {
            pid: worker.process.pid,
            signal,
          },
        });
      } else if (code !== 0) {
        logger.logError(new Error(`Worker exited with error`), {
          category: LogCategory.SYSTEM,
          additionalInfo: {
            pid: worker.process.pid,
            errorCode: code,
          },
        });
        logger.logAccess('Worker replacement initiated', {
          category: LogCategory.SYSTEM,
        });
        cluster.fork();
      } else {
        logger.logAccess('Worker completed successfully', {
          category: LogCategory.SYSTEM,
          additionalInfo: {
            pid: worker.process.pid,
          },
        });
      }
    });
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      category: LogCategory.SYSTEM,
      additionalInfo: {
        stage: 'startup',
        operation: 'primary_process_initialization',
      },
    });
    process.exit(1);
  }
}

// Main execution
if (cluster.isPrimary) {
  logger.logAccess('Primary process started', {
    category: LogCategory.SYSTEM,
    additionalInfo: {
      pid: process.pid,
    },
  });
  initializePrimaryProcess();
} else {
  startServer();
}
