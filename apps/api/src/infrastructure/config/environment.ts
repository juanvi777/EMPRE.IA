const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

export interface ApiConfig {
  readonly environment: 'development' | 'test' | 'production';
  readonly host: string;
  readonly logLevel: LogLevel;
  readonly port: number;
  readonly version: string;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnvironment)) {
    throw new Error('NODE_ENV debe ser development, test o production.');
  }

  const port = Number(environment.API_PORT ?? '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT debe ser un puerto entero entre 1 y 65535.');
  }

  const logLevel = environment.API_LOG_LEVEL ?? 'info';
  if (!LOG_LEVELS.includes(logLevel as LogLevel)) {
    throw new Error('API_LOG_LEVEL no es un nivel de logging permitido.');
  }

  const host = environment.API_HOST ?? '127.0.0.1';
  if (host.trim().length === 0) {
    throw new Error('API_HOST no puede estar vacío.');
  }

  return {
    environment: nodeEnvironment as ApiConfig['environment'],
    host,
    logLevel: logLevel as LogLevel,
    port,
    version: environment.npm_package_version ?? '0.1.0',
  };
}
