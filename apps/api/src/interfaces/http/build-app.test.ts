import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from '../../infrastructure/config/environment.js';
import { buildApp } from './build-app.js';

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createTestApp() {
  const app = buildApp(loadApiConfig({ NODE_ENV: 'test', API_PORT: '3001', API_LOG_LEVEL: 'error' }));
  apps.push(app);
  return app;
}

async function registerAndLogin(app: ReturnType<typeof buildApp>, suffix = Date.now()) {
  const email = `owner-${suffix}@test.local`;
  const register = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { companyName: `Empresa ${suffix}`, name: 'Owner Test', email, password: 'Password123!' },
  });
  expect(register.statusCode).toBe(201);
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'Password123!' } });
  expect(login.statusCode).toBe(200);
  return login.json() as { token: string };
}

describe('GET /health', () => {
  it('expone sólo diagnóstico no sensible', async () => {
    const app = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: 'empre-api', status: 'ok', environment: 'test', version: '0.4.2' });
    expect(response.json()).not.toHaveProperty('secrets');
  });
});

describe('POST /assistant', () => {
  it('requiere autenticación y responde usando el kernel local', async () => {
    const app = createTestApp();
    const anonymous = await app.inject({ method: 'POST', url: '/assistant', payload: { message: '¿Qué puedes hacer?' } });
    expect(anonymous.statusCode).toBe(401);

    const auth = await registerAndLogin(app, 'assistant');
    const response = await app.inject({
      method: 'POST',
      url: '/assistant',
      headers: { authorization: `Bearer ${auth.token}` },
      payload: { message: '¿Qué te diferencia?' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ mode: 'local-core', intent: 'difference' });
    expect(response.json().reply).toContain('contexto');
    expect(response.json()).not.toHaveProperty('apiKey');
  });

  it('responde de forma conversacional a un saludo', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'greeting');
    const response = await app.inject({
      method: 'POST',
      url: '/assistant',
      headers: { authorization: `Bearer ${auth.token}` },
      payload: { message: 'hola como estas' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ intent: 'greeting', dataSource: 'none' });
    expect(response.json().reply).toContain('Hola');
  });

  it('bloquea una petición operativa cuando no hay sistema conectado y explica cómo conectarlo', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'connection-gate');
    const response = await app.inject({
      method: 'POST',
      url: '/assistant',
      headers: { authorization: `Bearer ${auth.token}` },
      payload: { message: 'Analiza mis ventas de este mes' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ intent: 'connections', dataSource: 'none' });
    expect(response.json().reply).toContain('abre Integraciones');
    expect(response.json().reply).toContain('Conectar y verificar');
  });

  it('persiste historial conversacional por usuario', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'history');
    const headers = { authorization: `Bearer ${auth.token}` };

    const first = await app.inject({ method: 'POST', url: '/assistant', headers, payload: { message: 'hola' } });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'POST', url: '/assistant', headers, payload: { message: 'gracias' } });
    expect(second.statusCode).toBe(200);

    const history = await app.inject({ method: 'GET', url: '/assistant/history', headers });
    expect(history.statusCode).toBe(200);
    expect(history.json().messages.length).toBeGreaterThanOrEqual(4);

    const cleared = await app.inject({ method: 'POST', url: '/assistant/clear', headers });
    expect(cleared.statusCode).toBe(204);

    const afterClear = await app.inject({ method: 'GET', url: '/assistant/history', headers });
    expect(afterClear.statusCode).toBe(200);
    expect(afterClear.json().messages).toEqual([]);
  });

  it('rechaza mensajes vacíos', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'empty');
    const response = await app.inject({
      method: 'POST',
      url: '/assistant',
      headers: { authorization: `Bearer ${auth.token}` },
      payload: { message: '' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('Registro legal', () => {
  it('exige NIT cuando la empresa declara estar registrada', async () => {
    const app = createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        companyName: 'Empresa Legal Test',
        name: 'Owner Legal Test',
        email: `legal-${Date.now()}@test.local`,
        password: 'Password123!',
        businessType: 'legal_entity',
        legalRegistered: true,
        legalName: 'Empresa Legal Test S.A.S.',
        taxDeclaration: 'obligated',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('NIT');
  });
});

describe('Planes y núcleo', () => {
  it('crea la suscripción Free y expone cuatro planes', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'plans');
    const headers = { authorization: `Bearer ${auth.token}` };

    const billing = await app.inject({ method: 'GET', url: '/billing/plan', headers });
    expect(billing.statusCode).toBe(200);
    expect(billing.json().plan.name).toBe('Free');
    expect(billing.json().usage.used).toBe(0);

    const plans = await app.inject({ method: 'GET', url: '/plans', headers });
    expect(plans.statusCode).toBe(200);
    expect(plans.json().plans).toHaveLength(4);
  });

  it('permite una única integración de prueba en Free y bloquea la segunda', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'free-integration');
    const headers = { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' };

    const first = await app.inject({
      method: 'POST',
      url: '/connectors',
      headers,
      payload: { name: 'Sistema de prueba', preset: 'generic_rest', baseUrl: 'https://example.com', authMode: 'none' },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/connectors',
      headers,
      payload: { name: 'Sistema de prueba 2', preset: 'generic_rest', baseUrl: 'https://example.org', authMode: 'none' },
    });
    expect(second.statusCode).toBe(400);
    expect(second.json().message).toContain('permite 1 integraciones');
  });
});

describe('Bloqueo operativo', () => {
  it('rechaza acciones externas sin Connector operativo', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'action-gate');
    const response = await app.inject({
      method: 'POST',
      url: '/connector/actions',
      headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
      payload: { tool: 'appointments.create', input: { clientName: 'Prueba', service: 'Manicure', date: '2030-01-01', time: '10:00' } },
    });
    expect(response.statusCode).toBe(423);
    expect(response.json()).toMatchObject({ error: 'EXTERNAL_CONNECTION_REQUIRED' });
  });

  it('bloquea cambios de tareas sin Connector operativo', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'task-gate');
    const response = await app.inject({
      method: 'PATCH',
      url: '/dashboard/tasks/nonexistent',
      headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
      payload: { status: 'done' },
    });
    expect(response.statusCode).toBe(423);
  });
});

describe('Compra de plan', () => {
  it('requiere completar información legal/tributaria antes de pagar', async () => {
    const app = createTestApp();
    const auth = await registerAndLogin(app, 'billing-legal');
    const response = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
      payload: { planId: 'go', billingCycle: 'monthly' },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'LEGAL_SETUP_REQUIRED' });
  });
});
