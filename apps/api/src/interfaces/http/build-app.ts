import Fastify, { type FastifyInstance } from 'fastify';
import { getHealthReport } from '../../application/get-health-report.js';
import type { ApiConfig } from '../../infrastructure/config/environment.js';

export function buildApp(config: ApiConfig): FastifyInstance {
  const app = Fastify({ logger: { level: config.logLevel } });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Solicitud no procesada');
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'No fue posible procesar la solicitud.',
    });
  });

  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['service', 'status', 'environment', 'timestamp', 'uptimeSeconds', 'version'],
            properties: {
              service: { type: 'string' },
              status: { type: 'string' },
              environment: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              uptimeSeconds: { type: 'integer', minimum: 0 },
              version: { type: 'string' },
            },
          },
        },
      },
    },
    async () => getHealthReport(config, process.uptime()),
  );

  return app;
}
