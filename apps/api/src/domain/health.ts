export type HealthStatus = 'ok';

export interface HealthReport {
  readonly service: 'empre-api';
  readonly status: HealthStatus;
  readonly environment: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
  readonly version: string;
}
