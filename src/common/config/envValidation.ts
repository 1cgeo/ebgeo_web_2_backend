export function validateDBEnvVariables(): void {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ];

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required database environment variables: ${missingVars.join(', ')}`,
    );
  }

  // Validar se DB_PORT é um número válido
  const dbPort = Number(process.env.DB_PORT);
  if (isNaN(dbPort)) {
    throw new Error('DB_PORT must be a valid number');
  }
}

export function validateAuthEnvVariables(): void {
  const requiredAuthVars = ['JWT_SECRET', 'CSRF_SECRET'];

  const missingVars = requiredAuthVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required authentication variables: ${missingVars.join(', ')}`,
    );
  }

  // Validar origens permitidas
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const invalidOrigins = allowedOrigins.filter(origin => {
    try {
      new URL(origin);
      return false;
    } catch {
      return true;
    }
  });

  if (invalidOrigins.length > 0) {
    throw new Error(
      `Invalid origins in ALLOWED_ORIGINS: ${invalidOrigins.join(', ')}`,
    );
  }

  // Validar configurações de rate limit
  const rateLimitWindow = Number(process.env.RATE_LIMIT_WINDOW_MS);
  if (process.env.RATE_LIMIT_WINDOW_MS && isNaN(rateLimitWindow)) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be a valid number');
  }

  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX_REQUESTS);
  if (process.env.RATE_LIMIT_MAX_REQUESTS && isNaN(rateLimitMax)) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS must be a valid number');
  }
}

// Função para validar todas as variáveis de ambiente
export function validateEnvVariables(): void {
  validateDBEnvVariables();
  validateAuthEnvVariables();
}
