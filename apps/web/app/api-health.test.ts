import { describe, expect, it } from 'vitest';
import { getApiHealth } from './api-health.js';

describe('getApiHealth', () => {
  it('acepta un diagnóstico válido de la API', async () => {
    const state = await getApiHealth(
      async () =>
        new Response(
          JSON.stringify({
            service: 'empre-api',
            status: 'ok',
            environment: 'test',
            timestamp: '2026-09-24T00:00:00.000Z',
            uptimeSeconds: 1,
            version: '0.1.0',
          }),
          { status: 200 },
        ),
      'http://127.0.0.1:3001',
    );

    expect(state).toMatchObject({ available: true });
  });

  it('oculta detalles de transporte al usuario', async () => {
    const state = await getApiHealth(async () => {
      throw new Error('socket failure');
    });

    expect(state).toEqual({ available: false, reason: 'No fue posible contactar la API.' });
  });
});
