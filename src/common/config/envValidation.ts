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
  const requiredAuthVars = [
    'PORT',
    'JWT_SECRET',
    'CSRF_SECRET',
    'PASSWORD_PEPPER',
    'COOKIE_SECURE',
    'COOKIE_SAME_SITE',
  ];

  const missingVars = requiredAuthVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required authentication variables: ${missingVars.join(', ')}`,
    );
  }

  const port = Number(process.env.PORT);
  if (isNaN(port)) {
    throw new Error('PORT must be a valid number');
  }

  const pepper = process.env.PASSWORD_PEPPER;
  if (pepper && pepper.length < 32) {
    throw new Error('PASSWORD_PEPPER must be at least 32 characters long');
  }

  const cookieSecure = process.env.COOKIE_SECURE?.toLowerCase();
  if (cookieSecure && !['true', 'false'].includes(cookieSecure)) {
    throw new Error('COOKIE_SECURE must be either "true" or "false"');
  }

  const cookieSameSite = process.env.COOKIE_SAME_SITE?.toLowerCase();
  if (cookieSameSite && !['strict', 'lax', 'none'].includes(cookieSameSite)) {
    throw new Error('COOKIE_SAME_SITE must be one of: "strict", "lax", "none"');
  }

  // Se COOKIE_SAME_SITE é 'none', COOKIE_SECURE deve ser 'true'
  if (cookieSameSite === 'none' && cookieSecure !== 'true') {
    throw new Error(
      'When COOKIE_SAME_SITE is "none", COOKIE_SECURE must be "true"',
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
