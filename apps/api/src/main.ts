import { buildApp } from './interfaces/http/build-app.js';
import { loadApiConfig } from './infrastructure/config/environment.js';

const config = loadApiConfig();
const app = buildApp(config);

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, 'No se pudo iniciar la API');
  process.exitCode = 1;
}
