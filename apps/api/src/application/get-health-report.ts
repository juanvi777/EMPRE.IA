import type { HealthReport } from '../domain/health.js';
import type { ApiConfig } from '../infrastructure/config/environment.js';

export function getHealthReport(config: ApiConfig, uptimeSeconds: number): HealthReport {
  return {
    service: 'empre-api',
    status: 'ok',
    environment: config.environment,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(uptimeSeconds),
    version: config.version,
  };
}
