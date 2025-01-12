// src/server.ts
import cluster from 'cluster';
import os from 'os';
import https from 'https';
import http from 'http';
import fs from 'fs';
import app from './app.js';
import logger from './common/config/logger.js';
import { db, testDatabaseConnection } from './common/config/database.js';
import { validateEnvVariables } from './common/config/envValidation.js';
import { envManager } from './common/config/environment.js';

const numCPUs = os.cpus().length;
const numWorkers = Math.min(Math.floor(numCPUs / 3), 8);
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Validação única e centralizada de todas as variáveis de ambiente
    validateEnvVariables();
    logger.info('Environment variables validated successfully');

    // Testar conexão com banco
    await testDatabaseConnection();

    let server;

    if (envManager.useHttps()) {
      const httpsOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH || ''),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH || ''),
      };
      server = https.createServer(httpsOptions, app);
      logger.info('Starting server in HTTPS mode (Production)');
    } else {
      server = http.createServer(app);
      logger.info('Starting server in HTTP mode (Development)');
    }

    server.listen(PORT, () => {
      logger.info(
        `Worker ${process.pid}: Geographic Names Service started on port ${PORT}`,
        {
          environment: envManager.getEnvironment(),
          protocol: envManager.useHttps() ? 'https' : 'http',
        },
      );
    });

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.info('Shutting down server...');

      server.close(async () => {
        logger.info('HTTP/HTTPS server closed');

        try {
          await db.$pool.end();
          logger.info('Database connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', { error });
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error(
          'Could not close connections in time, forcefully shutting down',
        );
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', { error });
    process.exit(1);
  }
}

if (cluster.isPrimary) {
  logger.info(`Primary ${process.pid} is running`);

  startServer()
    .then(() => {
      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }

      cluster.on('exit', (worker, code, signal) => {
        if (signal) {
          logger.info(
            `Worker ${worker.process.pid} was killed by signal: ${signal}`,
          );
        } else if (code !== 0) {
          logger.error(
            `Worker ${worker.process.pid} exited with error code: ${code}`,
          );
          logger.info('Starting a new worker...');
          cluster.fork();
        } else {
          logger.info(`Worker ${worker.process.pid} success!`);
        }
      });
    })
    .catch(error => {
      logger.error('Server initialization failed:', { error });
      process.exit(1);
    });
} else {
  startServer();
}
