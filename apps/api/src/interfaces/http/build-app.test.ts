import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from '../../infrastructure/config/environment.js';
import { buildApp } from './build-app.js';

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('GET /health', () => {
  it('expone sólo diagnóstico no sensible', async () => {
    const app = buildApp(
      loadApiConfig({ NODE_ENV: 'test', API_PORT: '3001', API_LOG_LEVEL: 'error' }),
    );
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'empre-api',
      status: 'ok',
      environment: 'test',
      version: '0.1.0',
    });
    expect(response.json()).not.toHaveProperty('secrets');
  });
});
