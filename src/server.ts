import cluster from 'cluster';
import os from 'os';
import app from './app.js';
import logger from './common/config/logger.js';
import { db, testDatabaseConnection } from './common/config/database.js';
import { validateDBEnvVariables } from './common/config/envValidation.js';

const numCPUs = os.cpus().length;
const numWorkers = Math.min(Math.floor(numCPUs / 3), 8);
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Validar variáveis de ambiente
    validateDBEnvVariables();

    // Testar conexão com banco
    await testDatabaseConnection();

    const server = app.listen(PORT, () => {
      logger.info(
        `Worker ${process.pid}: Geographic Names Service started on port ${PORT}`,
      );
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Fechar conexão com banco
          await db.$pool.end();
          logger.info('Database connections closed');

          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', { error });
          process.exit(1);
        }
      });

      // Força o fechamento após 30s
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

  // Testar banco antes de criar workers
  testDatabaseConnection()
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
      logger.error('Database connection failed:', { error });
      process.exit(1);
    });
} else {
  startServer();
}
