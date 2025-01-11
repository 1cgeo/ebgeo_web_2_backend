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
