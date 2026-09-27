import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { getHealthReport } from '../../application/get-health-report.js';
import { audit, ensurePlatformAdminFromEnv, getPlatformAdminFromToken, getUserFromToken, hasPermission, login, logout, platformLogin, platformLogout, register } from '../../application/auth.js';
import { getCoreBrief, answerWithKernel } from '../../application/ai-kernel.js';
import { isRealAiConfigured } from '../../application/ai-provider.js';
import { clearAssistantHistory, getAssistantHistory } from '../../application/assistant-history.js';
import { assignTenantPlanManually, changeTenantPlan, ensureSeedCoreData, getPlans, getTenantPlan, getTenantSubscriptionRecord, getUsageSnapshot, getBillingProviderStatus, getOrCreateMercadoPagoCheckout, getMercadoPagoPaymentMethods, type BillingCycle } from '../../application/billing.js';
import { getCompanyProfile, updateCompanyProfile, validateNit } from '../../application/company.js';
import { db, rows, row } from '../../infrastructure/db/database.js';
import { getDashboardSummary, updateAgent, updateAutomation, updateTask } from '../../application/dashboard.js';
import { createConnector, connectorProbe, getConnectorTools, getConnectors, getPrimaryConnector, hasOperationalConnection, testConnector, executeConnectorTool, type ConnectorAuthMode } from '../../application/connectors.js';
import { syncMercadoPagoOrder } from '../../application/billing.js';
import type { ApiConfig } from '../../infrastructure/config/environment.js';
import type { AppUser } from '../../infrastructure/db/database.js';

interface AuthenticatedRequest extends FastifyRequest { empreUser?: AppUser }

declare module 'fastify' { interface FastifyRequest { empreUser?: AppUser } }

function bearer(request: FastifyRequest): string | undefined {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ')) return undefined;
  return value.slice('Bearer '.length).trim();
}

async function requireAuth(request: AuthenticatedRequest, reply: FastifyReply): Promise<boolean> {
  const token = bearer(request);
  const user = token ? getUserFromToken(token) : undefined;
  if (!user) {
    await reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Sesión inválida o expirada.' });
    return false;
  }
  request.empreUser = user;
  return true;
}

async function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const token = bearer(request);
  const admin = token ? getPlatformAdminFromToken(token) : undefined;
  if (!admin) {
    await reply.code(401).send({ error: 'UNAUTHORIZED_PLATFORM', message: 'Sesión de propietario inválida o expirada.' });
    return false;
  }
  (request as AuthenticatedRequest & { platformAdmin?: typeof admin }).platformAdmin = admin;
  return true;
}

function isAdmin(user: AppUser): boolean {
  return user.role === 'owner' || user.role === 'admin';
}

export function buildApp(config: ApiConfig): FastifyInstance {
  ensureSeedCoreData();
  ensurePlatformAdminFromEnv();
  const app = Fastify({ logger: { level: config.logLevel } });

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && config.webOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'content-type, authorization');
      reply.header('Access-Control-Max-Age', '600');
      reply.header('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') return reply.code(204).send();
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Solicitud no procesada');
    return reply.status(500).send({ error: 'INTERNAL_SERVER_ERROR', message: 'No fue posible procesar la solicitud.' });
  });

  app.get('/health', async () => getHealthReport(config, process.uptime()));

  app.post('/auth/register', async (request, reply) => {
    try {
      const body = request.body as { companyName?: string; name?: string; email?: string; password?: string; countryCode?: string; businessType?: 'legal_entity'|'natural_person'|'informal'; legalRegistered?: boolean; legalName?: string; nit?: string; nitDv?: string; taxDeclaration?: 'obligated'|'not_obligated'|'unknown' };
      const user = register({
        companyName: body.companyName ?? '',
        name: body.name ?? '',
        email: body.email ?? '',
        password: body.password ?? '',
        countryCode: body.countryCode ?? 'CO',
        businessType: body.businessType,
        legalRegistered: body.legalRegistered,
        legalName: body.legalName,
        nit: body.nit,
        nitDv: body.nitDv,
        taxDeclaration: body.taxDeclaration,
      });
      return reply.code(201).send({ user });
    } catch (error) {
      return reply.code(400).send({ error: 'REGISTRATION_FAILED', message: error instanceof Error ? error.message : 'No se pudo registrar la empresa.' });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    try {
      const body = request.body as { email?: string; password?: string };
      return reply.send(login({ email: body.email ?? '', password: body.password ?? '' }));
    } catch (error) {
      return reply.code(401).send({ error: 'LOGIN_FAILED', message: error instanceof Error ? error.message : 'No se pudo iniciar sesión.' });
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = bearer(request);
    if (token) logout(token);
    return reply.code(204).send();
  });

  app.get('/auth/me', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    return reply.send({ user: request.empreUser });
  });

  app.post('/platform/login', async (request, reply) => {
    try {
      const body = request.body as { email?: string; password?: string };
      return reply.send(platformLogin({ email: body.email ?? '', password: body.password ?? '' }));
    } catch (error) {
      return reply.code(401).send({ error: 'PLATFORM_LOGIN_FAILED', message: error instanceof Error ? error.message : 'No se pudo iniciar sesión de propietario.' });
    }
  });

  app.post('/platform/logout', async (request, reply) => {
    const token = bearer(request);
    if (token) platformLogout(token);
    return reply.code(204).send();
  });

  app.get('/platform/me', async (request, reply) => {
    if (!(await requirePlatformAdmin(request, reply))) return;
    return reply.send({ admin: (request as AuthenticatedRequest & { platformAdmin?: unknown }).platformAdmin });
  });

  app.get('/platform/tenants', async (request, reply) => {
    if (!(await requirePlatformAdmin(request, reply))) return;
    const tenants = rows<{ id:string; name:string; slug:string; status:string; created_at:string; legal_registered:number; legal_name:string|null; nit:string|null }>(db.prepare('SELECT id,name,slug,status,created_at,legal_registered,legal_name,nit FROM tenants ORDER BY created_at DESC'));
    const output = tenants.map((tenant) => {
      const owner = row<{ name:string; email:string }>(db.prepare("SELECT u.name,u.email FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.tenant_id=? AND m.role='owner' LIMIT 1"), tenant.id);
      const subscription = getTenantSubscriptionRecord(tenant.id);
      const plan = getTenantPlan(tenant.id);
      return { ...tenant, ownerName: owner?.name ?? null, ownerEmail: owner?.email ?? null, plan: plan.name, planId: subscription.planId, subscriptionSource: subscription.subscriptionSource, subscriptionStatus: subscription.status, assignmentNote: subscription.assignmentNote };
    });
    return reply.send({ tenants: output });
  });

  app.patch('/platform/tenants/:tenantId/plan', async (request, reply) => {
    if (!(await requirePlatformAdmin(request, reply))) return;
    const params = request.params as { tenantId: string };
    const body = request.body as { planId?: string; note?: string };
    if (!['free','go','pro','business'].includes(body.planId ?? '')) return reply.code(400).send({ message: 'Plan inválido.' });
    const tenant = row<{ id:string; name:string }>(db.prepare('SELECT id,name FROM tenants WHERE id=?'), params.tenantId);
    if (!tenant) return reply.code(404).send({ message: 'Empresa no encontrada.' });
    assignTenantPlanManually(tenant.id, body.planId as 'free'|'go'|'pro'|'business', 'primary', body.note ?? 'Asignación manual del propietario');
    const admin = (request as AuthenticatedRequest & { platformAdmin?: { id:string } }).platformAdmin;
    audit(tenant.id, null, 'platform.subscription.assign', 'subscription', tenant.id, 'success', { planId: body.planId, platformAdminId: admin?.id ?? 'primary', note: (body.note ?? '').slice(0, 500) });
    return reply.send({ ok: true, tenantId: tenant.id, plan: getTenantPlan(tenant.id), subscription: getTenantSubscriptionRecord(tenant.id) });
  });

  app.get('/company/profile', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'company.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar la empresa.' });
    return reply.send({ company: getCompanyProfile(request.empreUser!.tenantId) });
  });

  app.post('/company/nit/validate', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'company.read')) return reply.code(403).send({ message: 'No tienes permiso para validar el NIT.' });
    const body = request.body as { nit?: string; nitDv?: string };
    return reply.send(validateNit(String(body.nit ?? ''), body.nitDv));
  });

  app.patch('/company/profile', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user) || !hasPermission(user.id, 'company.write')) return reply.code(403).send({ message: 'Sólo el propietario o administrador puede cambiar los datos legales de la empresa.' });
    const body = request.body as Partial<{ countryCode: string; businessType: 'legal_entity'|'natural_person'|'informal'; legalRegistered: boolean; legalName: string | null; nit: string | null; nitDv: string | null; taxDeclaration: 'obligated'|'not_obligated'|'unknown'; taxResponsibilities: string[] }>;
    const company = updateCompanyProfile(user.tenantId, body);
    audit(user.tenantId, user.id, 'company.profile.update', 'company', user.tenantId, 'success', { nitVerificationStatus: company.nitVerificationStatus, legalSetupCompleted: company.legalSetupCompleted });
    return reply.send({ company });
  });

  app.get('/connectors', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!hasPermission(user.id, 'connectors.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar conectores.' });
    const connectors = getConnectors(user.tenantId);
    return reply.send({ connected: hasOperationalConnection(user.tenantId), primary: getPrimaryConnector(user.tenantId), connectors });
  });

  app.post('/connectors', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user) || !hasPermission(user.id, 'connectors.write')) return reply.code(403).send({ message: 'Sólo el propietario o administrador puede crear conectores.' });
    try {
      const body = request.body as { name?: string; preset?: string; baseUrl?: string; authMode?: ConnectorAuthMode; healthPath?: string; verificationPath?: string; loginPath?: string; manifestPath?: string; apiKeyHeader?: string; username?: string; secret?: string; tools?: unknown[] };
      const connector = createConnector(user.tenantId, { ...body, baseUrl: body.baseUrl ?? '', authMode: body.authMode ?? 'none' });
      audit(user.tenantId, user.id, 'connector.create', 'connector', connector.id, 'success', { preset: connector.preset, authMode: connector.authMode });
      return reply.code(201).send({ connector });
    } catch (error) {
      return reply.code(400).send({ error: 'CONNECTOR_CREATE_FAILED', message: error instanceof Error ? error.message : 'No se pudo crear el conector.' });
    }
  });

  app.post('/connectors/:id/test', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user) || !hasPermission(user.id, 'connectors.write')) return reply.code(403).send({ message: 'Sólo el propietario o administrador puede probar conectores.' });
    try {
      const result = await testConnector(user.tenantId, (request.params as { id: string }).id);
      audit(user.tenantId, user.id, 'connector.test', 'connector', result.connector.id, 'success', { preset: result.connector.preset });
      return reply.send(result);
    } catch (error) {
      audit(user.tenantId, user.id, 'connector.test', 'connector', (request.params as { id: string }).id, 'failed', { message: error instanceof Error ? error.message : 'error' });
      return reply.code(409).send({ error: 'CONNECTOR_TEST_FAILED', message: error instanceof Error ? error.message : 'No se pudo probar el conector.' });
    }
  });

  app.get('/connector/probe', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!hasPermission(user.id, 'connectors.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar el conector.' });
    try {
      return reply.send({ connected: true, ...await connectorProbe(user.tenantId) });
    } catch (error) {
      return reply.code(409).send({ connected: false, message: error instanceof Error ? error.message : 'No se pudo consultar el sistema externo.' });
    }
  });

  app.delete('/connectors/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user) || !hasPermission(user.id, 'connectors.write')) return reply.code(403).send({ message: 'Sólo el propietario o administrador puede desconectar sistemas.' });
    const connectorId = (request.params as { id: string }).id;
    const existing = row<{ id: string; name: string }>(db.prepare('SELECT id,name FROM connectors WHERE tenant_id=? AND id=?'), user.tenantId, connectorId);
    if (!existing) return reply.code(404).send({ message: 'Conector no encontrado.' });
    db.prepare('DELETE FROM connectors WHERE tenant_id=? AND id=?').run(user.tenantId, connectorId);
    audit(user.tenantId, user.id, 'connector.delete', 'connector', connectorId, 'success', { name: existing.name });
    return reply.code(204).send();
  });

  app.get('/billing/status', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'billing.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar facturación.' });
    return reply.send({ provider: getBillingProviderStatus(), billingStatus: 'ready-for-provider-configuration' });
  });

  app.post('/billing/checkout', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user) || !hasPermission(user.id, 'billing.write')) return reply.code(403).send({ message: 'Sólo el propietario o administrador puede iniciar una compra.' });
    const body = request.body as { planId?: 'go'|'pro'|'business'; billingCycle?: BillingCycle };
    const planId = body.planId;
    const billingCycle = body.billingCycle === 'annual' ? 'annual' : 'monthly';
    if (!planId || !['go','pro','business'].includes(planId)) return reply.code(400).send({ message: 'Plan de pago inválido.' });
    const subscription = getTenantSubscriptionRecord(user.tenantId);
    if (subscription.subscriptionSource === 'manual') {
      return reply.code(409).send({ error: 'PLATFORM_MANAGED_SUBSCRIPTION', message: 'El plan de esta empresa es administrado manualmente por EMPRE.IA. Contacta al propietario para cambiarlo.' });
    }
    const company = getCompanyProfile(user.tenantId);
    if (!company.legalSetupCompleted) {
      return reply.code(422).send({ error: 'LEGAL_SETUP_REQUIRED', message: 'Completa primero la información legal y tributaria de tu empresa en “Mi empresa” antes de contratar un plan de pago.' });
    }
    try {
      const checkout = await getOrCreateMercadoPagoCheckout(user.tenantId, planId, billingCycle, user.email);
      audit(user.tenantId, user.id, 'billing.checkout.create', 'checkout', checkout.checkoutId, 'success', { planId, billingCycle, provider: 'mercado-pago', checkoutMethod: checkout.checkoutMethod, automaticActivation: checkout.automaticActivation });
      return reply.send(checkout);
    } catch (error) {
      return reply.code(409).send({ error: 'BILLING_NOT_READY', message: error instanceof Error ? error.message : 'No se pudo preparar el pago.' });
    }
  });


  app.get('/billing/checkout-status', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!hasPermission(user.id, 'billing.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar el pago.' });
    const query = request.query as { orderId?: string; checkoutId?: string };
    const orderId = String(query.orderId ?? '').trim();
    const checkoutId = String(query.checkoutId ?? '').trim();
    const checkout = checkoutId
      ? row<{ tenant_id: string; plan_id: string; billing_cycle: string; provider_order_id: string | null; status: string }>(db.prepare('SELECT tenant_id,plan_id,billing_cycle,provider_order_id,status FROM billing_checkout_sessions WHERE id=? AND tenant_id=?'), checkoutId, user.tenantId)
      : orderId
        ? row<{ tenant_id: string; plan_id: string; billing_cycle: string; provider_order_id: string | null; status: string }>(db.prepare('SELECT tenant_id,plan_id,billing_cycle,provider_order_id,status FROM billing_checkout_sessions WHERE provider_order_id=? AND tenant_id=?'), orderId, user.tenantId)
        : undefined;
    if (!checkout) return reply.code(404).send({ message: 'Pago no encontrado para esta empresa.' });
    if (!checkout.provider_order_id) return reply.send({ status: checkout.status, activated: false, automaticActivation: false, message: 'Este pago usa un Link de Pago manual y no tiene una order consultable automáticamente.' });
    try {
      const result = await syncMercadoPagoOrder(checkout.provider_order_id);
      audit(user.tenantId, user.id, 'billing.order.sync', 'order', checkout.provider_order_id, 'success', result);
      return reply.send(result);
    } catch (error) {
      return reply.code(409).send({ message: error instanceof Error ? error.message : 'No se pudo verificar el pago.' });
    }
  });

  app.get('/billing/payment-methods', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!hasPermission(user.id, 'billing.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar medios de pago.' });
    try {
      const methods = await getMercadoPagoPaymentMethods();
      return reply.send({ methods, notes: ['En Colombia, Checkout Pro puede ofrecer tarjetas, dinero en cuenta y medios offline; PSE es un método de transferencia disponible en el ecosistema de Mercado Pago.', 'NEQUI aparece como entidad financiera dentro de PSE en la documentación de Checkout API. La disponibilidad final depende de la configuración y solución habilitada para la cuenta.'] });
    } catch (error) {
      return reply.code(409).send({ message: error instanceof Error ? error.message : 'No se pudieron consultar los medios de pago.' });
    }
  });

  app.post('/billing/mercadopago/webhook', async (request, reply) => {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
    if (!secret) return reply.code(503).send({ message: 'Webhook de Mercado Pago no configurado en el servidor.' });

    const signatureHeader = String(request.headers['x-signature'] ?? '');
    const requestId = String(request.headers['x-request-id'] ?? '');
    const query = request.query as Record<string, string | undefined>;
    const dataId = String(query['data.id'] ?? '');
    const eventType = String(query.type ?? (typeof request.body === 'object' && request.body !== null && 'type' in request.body ? (request.body as { type?: unknown }).type : 'unknown') ?? 'unknown');
    const tsMatch = signatureHeader.match(/(?:^|,)ts=([^,]+)/);
    const v1Match = signatureHeader.match(/(?:^|,)v1=([^,]+)/);
    if (!requestId || !dataId || !tsMatch?.[1] || !v1Match?.[1]) {
      return reply.code(401).send({ message: 'Firma del webhook incompleta.' });
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${tsMatch[1]};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    const supplied = v1Match[1];
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const suppliedBuffer = Buffer.from(supplied, 'utf8');
    if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return reply.code(401).send({ message: 'Firma del webhook inválida.' });
    }

    db.prepare(`INSERT INTO billing_webhook_events (id,provider,event_type,external_id,payload_json,created_at) VALUES (?,?,?,?,?,?)`)
      .run(`mpwh_${randomBytes(10).toString('hex')}`, 'mercado-pago', eventType, dataId, JSON.stringify(request.body ?? {}), new Date().toISOString());

    let synchronized = false;
    if (eventType === 'order' || String((request.body as { type?: unknown } | null)?.type ?? '') === 'order') {
      try {
        const result = await syncMercadoPagoOrder(dataId);
        synchronized = result.activated;
      } catch (error) {
        request.log.warn({ err: error }, 'No se pudo sincronizar la order de Mercado Pago todavía');
      }
    }
    return reply.code(200).send({ ok: true, received: true, synchronized });
  });

  app.get('/core/brief', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'core.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar el núcleo de EMPRE.IA.' });
    return reply.send(getCoreBrief());
  });

  app.get('/core/ai-profile', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'core.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar la configuración de IA.' });
    const profile = row<Record<string, unknown>>(db.prepare('SELECT objective,operating_mode,autonomy_level,provider,model,memory_mode,data_policy,updated_at FROM ai_profiles WHERE tenant_id=?'), request.empreUser!.tenantId);
    const policies = rows<{ action_key: string; effect: string; requires_approval: number; enabled: number }>(db.prepare('SELECT action_key,effect,requires_approval,enabled FROM policy_rules WHERE tenant_id=? ORDER BY action_key'), request.empreUser!.tenantId);
    return reply.send({ profile, policies });
  });

  app.patch('/core/ai-profile', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user) || !hasPermission(user.id, 'settings.ai.write')) return reply.code(403).send({ message: 'Sólo un propietario o administrador puede cambiar esta configuración.' });
    const body = request.body as Partial<{ objective: string; operatingMode: string; autonomyLevel: string; memoryMode: string; dataPolicy: string }>;
    const allowedOperating = new Set(['supervised']);
    const allowedAutonomy = new Set(['approval-required', 'suggest-only']);
    const objective = typeof body.objective === 'string' && body.objective.trim() ? body.objective.trim().slice(0, 500) : undefined;
    const operatingMode = typeof body.operatingMode === 'string' && allowedOperating.has(body.operatingMode) ? body.operatingMode : undefined;
    const autonomyLevel = typeof body.autonomyLevel === 'string' && allowedAutonomy.has(body.autonomyLevel) ? body.autonomyLevel : undefined;
    const memoryMode = typeof body.memoryMode === 'string' && ['tenant-scoped'].includes(body.memoryMode) ? body.memoryMode : undefined;
    const dataPolicy = typeof body.dataPolicy === 'string' && ['minimize-and-redact'].includes(body.dataPolicy) ? body.dataPolicy : undefined;
    const current = row<{ objective:string; operating_mode:string; autonomy_level:string; memory_mode:string; data_policy:string }>(db.prepare('SELECT objective,operating_mode,autonomy_level,memory_mode,data_policy FROM ai_profiles WHERE tenant_id=?'), user.tenantId);
    if (!current) return reply.code(404).send({ message: 'Perfil de IA no encontrado.' });
    db.prepare(`UPDATE ai_profiles SET objective=?,operating_mode=?,autonomy_level=?,memory_mode=?,data_policy=?,updated_at=datetime('now') WHERE tenant_id=?`)
      .run(objective ?? current.objective, operatingMode ?? current.operating_mode, autonomyLevel ?? current.autonomy_level, memoryMode ?? current.memory_mode, dataPolicy ?? current.data_policy, user.tenantId);
    audit(user.tenantId, user.id, 'ai-profile.update', 'ai_profile', user.tenantId, 'success', {});
    return reply.send({ ok: true });
  });

  app.get('/plans', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'plans.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar los planes.' });
    return reply.send({ plans: getPlans(), pricingStatus: 'proposal-local' });
  });

  app.get('/billing/plan', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'plans.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar el plan.' });
    return reply.send({ plan: getTenantPlan(request.empreUser!.tenantId), usage: getUsageSnapshot(request.empreUser!.tenantId), billingStatus: 'local-simulator' });
  });

  app.patch('/billing/plan', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user) || !hasPermission(user.id, 'plans.write')) return reply.code(403).send({ message: 'Sólo un propietario o administrador puede cambiar el plan.' });
    const planId = String((request.body as { planId?: string })?.planId ?? '');
    if (!['free', 'go', 'pro', 'business'].includes(planId)) return reply.code(400).send({ message: 'Plan inválido.' });
    changeTenantPlan(user.tenantId, planId as 'free' | 'go' | 'pro' | 'business');
    audit(user.tenantId, user.id, 'billing.plan.change', 'subscription', user.tenantId, 'success', { planId });
    return reply.send({ plan: getTenantPlan(user.tenantId), usage: getUsageSnapshot(user.tenantId), billingStatus: 'local-simulator' });
  });

  app.get('/usage', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'usage.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar el consumo.' });
    return reply.send(getUsageSnapshot(request.empreUser!.tenantId));
  });

  app.get('/dashboard/summary', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    return reply.send(getDashboardSummary(request.empreUser!.tenantId));
  });

  app.patch('/dashboard/tasks/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: { status?: 'pending'|'done' } }>, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasOperationalConnection(request.empreUser!.tenantId)) return reply.code(423).send({ error: 'EXTERNAL_CONNECTION_REQUIRED', message: 'Conecta y verifica el sistema de tu empresa antes de ejecutar acciones operativas.' });
    if (!hasPermission(request.empreUser!.id, 'tasks.write')) return reply.code(403).send({ message: 'No tienes permiso para modificar tareas.' });
    const status = request.body.status === 'done' ? 'done' : 'pending';
    if (!updateTask(request.empreUser!.tenantId, request.params.id, status)) return reply.code(404).send({ message: 'Tarea no encontrada.' });
    audit(request.empreUser!.tenantId, request.empreUser!.id, 'task.update', 'task', request.params.id, 'success', { status });
    return reply.send({ ok: true });
  });

  app.patch('/dashboard/agents/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: { status?: 'active'|'paused' } }>, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasOperationalConnection(request.empreUser!.tenantId)) return reply.code(423).send({ error: 'EXTERNAL_CONNECTION_REQUIRED', message: 'Conecta y verifica el sistema de tu empresa antes de ejecutar acciones operativas.' });
    if (!hasPermission(request.empreUser!.id, 'agents.write')) return reply.code(403).send({ message: 'No tienes permiso para modificar agentes.' });
    const status = request.body.status === 'paused' ? 'paused' : 'active';
    if (!updateAgent(request.empreUser!.tenantId, request.params.id, status)) return reply.code(404).send({ message: 'Agente no encontrado.' });
    audit(request.empreUser!.tenantId, request.empreUser!.id, 'agent.update', 'agent', request.params.id, 'success', { status });
    return reply.send({ ok: true });
  });

  app.patch('/dashboard/automations/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: { status?: 'active'|'paused' } }>, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasOperationalConnection(request.empreUser!.tenantId)) return reply.code(423).send({ error: 'EXTERNAL_CONNECTION_REQUIRED', message: 'Conecta y verifica el sistema de tu empresa antes de ejecutar acciones operativas.' });
    if (!hasPermission(request.empreUser!.id, 'automations.write')) return reply.code(403).send({ message: 'No tienes permiso para modificar automatizaciones.' });
    const status = request.body.status === 'paused' ? 'paused' : 'active';
    if (!updateAutomation(request.empreUser!.tenantId, request.params.id, status)) return reply.code(404).send({ message: 'Automatización no encontrada.' });
    audit(request.empreUser!.tenantId, request.empreUser!.id, 'automation.update', 'automation', request.params.id, 'success', { status });
    return reply.send({ ok: true });
  });

  app.get('/audit', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'audit.read')) return reply.code(403).send({ message: 'No tienes permiso para consultar la auditoría.' });
    const events = rows<{ id:string; action:string; resource_type:string; result:string; created_at:string }>(
      db.prepare('SELECT id,action,resource_type,result,created_at FROM audit_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50'), request.empreUser!.tenantId,
    );
    return reply.send({ events });
  });

  app.get('/ai/status', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    if (!hasPermission(request.empreUser!.id, 'assistant.use')) return reply.code(403).send({ message: 'No tienes permiso para consultar el estado de la IA.' });
    return reply.send({
      configured: isRealAiConfigured(),
      provider: isRealAiConfigured() ? 'openai' : 'local-kernel',
      webSearchEnabled: isRealAiConfigured() && process.env.EMPRE_WEB_SEARCH_ENABLED?.trim().toLowerCase() !== 'false',
      webSearchMode: isRealAiConfigured() ? 'live' : 'disabled',
    });
  });

  app.get('/assistant/history', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!hasPermission(user.id, 'assistant.use')) return reply.code(403).send({ message: 'No tienes permiso para usar EMPRE.IA.' });
    return reply.send({ messages: getAssistantHistory(user.tenantId, user.id, 24) });
  });

  app.post('/assistant/clear', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!hasPermission(user.id, 'assistant.use')) return reply.code(403).send({ message: 'No tienes permiso para usar EMPRE.IA.' });
    clearAssistantHistory(user.tenantId, user.id);
    audit(user.tenantId, user.id, 'assistant.clear', 'assistant', null, 'success', {});
    return reply.code(204).send();
  });

  app.post('/connector/actions', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!hasOperationalConnection(user.tenantId)) return reply.code(423).send({ error: 'EXTERNAL_CONNECTION_REQUIRED', message: 'Conecta y verifica el sistema externo antes de ejecutar una herramienta.' });
    if (!hasPermission(user.id, 'tools.execute') || !isAdmin(user)) return reply.code(403).send({ message: 'Sólo un propietario o administrador puede solicitar acciones externas.' });
    const body = request.body as { tool?: string; input?: Record<string, unknown> };
    const tool = String(body.tool ?? '').trim();
    const toolDefinition = getConnectorTools(user.tenantId).find((item) => item.name === tool);
    if (!toolDefinition) return reply.code(400).send({ message: 'La herramienta no está disponible para la conexión actual.' });
    const readOnly = toolDefinition.readOnly;
    if (readOnly) {
      try {
        const result = await executeConnectorTool(user.tenantId, tool, body.input ?? {});
        audit(user.tenantId, user.id, 'connector.tool.execute', 'tool', tool, 'success', { mode: 'read' });
        return reply.send({ status: 'completed', tool, result });
      } catch (error) {
        audit(user.tenantId, user.id, 'connector.tool.execute', 'tool', tool, 'failed', { message: error instanceof Error ? error.message : 'error', mode: 'read' });
        return reply.code(409).send({ message: error instanceof Error ? error.message : 'No se pudo ejecutar la herramienta.' });
      }
    }
    const approvalId = `approval_${randomBytes(10).toString('hex')}`;
    const now = new Date().toISOString();
    db.prepare('INSERT INTO approval_requests (id,tenant_id,requested_by,tool_name,input_json,status,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(approvalId, user.tenantId, user.id, tool, JSON.stringify(body.input ?? {}), 'pending', now);
    audit(user.tenantId, user.id, 'connector.tool.requested', 'approval', approvalId, 'pending', { tool });
    return reply.code(202).send({ status: 'pending_approval', approvalId, tool, message: 'La acción externa requiere aprobación antes de ejecutarse.' });
  });

  app.get('/connector/actions/pending', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user)) return reply.code(403).send({ message: 'Sólo un propietario o administrador puede revisar aprobaciones.' });
    const approvals = rows<Record<string, unknown>>(db.prepare("SELECT id,tool_name,input_json,status,created_at FROM approval_requests WHERE tenant_id=? AND status='pending' ORDER BY created_at ASC"), user.tenantId);
    return reply.send({ approvals: approvals.map((item) => ({ id: String(item.id), tool: String(item.tool_name), input: JSON.parse(String(item.input_json)), status: String(item.status), createdAt: String(item.created_at) })) });
  });

  app.post('/connector/actions/:id/approve', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!isAdmin(user) || !hasPermission(user.id, 'tools.execute')) return reply.code(403).send({ message: 'Sólo un propietario o administrador puede aprobar acciones externas.' });
    const actionId = (request.params as { id: string }).id;
    const approval = row<{ id: string; tool_name: string; input_json: string; status: string; requested_by: string }>(db.prepare("SELECT id,tool_name,input_json,status,requested_by FROM approval_requests WHERE id=? AND tenant_id=?"), actionId, user.tenantId);
    if (!approval) return reply.code(404).send({ message: 'Solicitud de aprobación no encontrada.' });
    if (approval.status !== 'pending') return reply.code(409).send({ message: `La aprobación ya está en estado ${approval.status}.` });
    if (!hasOperationalConnection(user.tenantId)) return reply.code(423).send({ error: 'EXTERNAL_CONNECTION_REQUIRED', message: 'La conexión dejó de estar operativa. La acción no se ejecutará.' });
    const input = JSON.parse(approval.input_json) as Record<string, unknown>;
    try {
      const result = await executeConnectorTool(user.tenantId, approval.tool_name, input);
      db.prepare("UPDATE approval_requests SET status='approved',result_json=?,resolved_at=? WHERE id=? AND tenant_id=?").run(JSON.stringify(result), new Date().toISOString(), actionId, user.tenantId);
      audit(user.tenantId, user.id, 'connector.tool.approve', 'approval', actionId, 'success', { tool: approval.tool_name });
      return reply.send({ status: 'completed', tool: approval.tool_name, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo ejecutar la acción.';
      db.prepare("UPDATE approval_requests SET status='failed',result_json=?,resolved_at=? WHERE id=? AND tenant_id=?").run(JSON.stringify({ message }), new Date().toISOString(), actionId, user.tenantId);
      audit(user.tenantId, user.id, 'connector.tool.approve', 'approval', actionId, 'failed', { tool: approval.tool_name, message });
      return reply.code(409).send({ message });
    }
  });

  app.post('/assistant', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const user = request.empreUser!;
    if (!hasPermission(user.id, 'assistant.use')) return reply.code(403).send({ message: 'No tienes permiso para usar EMPRE.IA.' });
    const body = request.body as { message?: string };
    const message = String(body.message ?? '').trim();
    if (!message || message.length > 2000) return reply.code(400).send({ message: 'Mensaje inválido.' });
    const response = await answerWithKernel(user.tenantId, user.id, message);
    audit(user.tenantId, user.id, 'assistant.message', 'assistant', null, 'success', { length: message.length, intent: response.intent, usageUnits: response.usageUnits });
    return reply.send(response);
  });

  return app;
}
