import { randomBytes } from 'node:crypto';
import { db, nowIso, row, rows } from '../infrastructure/db/database.js';
import { EMPRE_IDENTITY, EMPRE_POLICY_DEFAULTS, getPlanDefinition, PLAN_DEFINITIONS, type PlanId } from '../domain/empre-core.js';

function id(prefix: string): string { return `${prefix}_${randomBytes(10).toString('hex')}`; }

export interface TenantPlanSnapshot {
  readonly id: PlanId;
  readonly name: string;
  readonly monthlyCop: number;
  readonly annualCop: number;
  readonly monthlyCredits: number;
  readonly aiLevel: 'basic' | 'advanced';
  readonly integrationsLimit: number | null;
  readonly summary: string;
  readonly highlights: readonly string[];
}

export function ensureTenantPlan(tenantId: string, planId: PlanId = 'free'): void {
  const existing = row<{ tenant_id: string }>(db.prepare('SELECT tenant_id FROM tenant_subscriptions WHERE tenant_id = ?'), tenantId);
  if (existing) return;
  const now = nowIso();
  db.prepare('INSERT OR IGNORE INTO tenant_subscriptions (tenant_id,plan_id,status,started_at,updated_at) VALUES (?,?,?,?,?)')
    .run(tenantId, planId, 'active', now, now);
}

export function getTenantPlan(tenantId: string): TenantPlanSnapshot {
  ensureTenantPlan(tenantId);
  const subscription = row<{ plan_id: PlanId; status: string }>(db.prepare('SELECT plan_id,status FROM tenant_subscriptions WHERE tenant_id = ?'), tenantId);
  const plan = getPlanDefinition(subscription?.plan_id ?? 'free');
  return { ...plan };
}

export function getPlans(): TenantPlanSnapshot[] { return PLAN_DEFINITIONS.map((plan) => ({ ...plan })); }

export function recordUsage(tenantId: string, eventType: string, units: number, metadata: Record<string, unknown> = {}): void {
  if (!Number.isFinite(units) || units <= 0) return;
  db.prepare('INSERT INTO usage_ledger (id,tenant_id,event_type,units,metadata_json,created_at) VALUES (?,?,?,?,?,?)')
    .run(id('usage'), tenantId, eventType, Math.ceil(units), JSON.stringify(metadata), nowIso());
}

export function getUsageSnapshot(tenantId: string, date = new Date()) {
  const month = date.toISOString().slice(0, 7);
  const used = Number(row<{ units: number }>(db.prepare("SELECT COALESCE(SUM(units),0) AS units FROM usage_ledger WHERE tenant_id=? AND substr(created_at,1,7)=?"), tenantId, month)?.units ?? 0);
  const plan = getTenantPlan(tenantId);
  const remaining = Math.max(plan.monthlyCredits - used, 0);
  return { month, used, limit: plan.monthlyCredits, remaining, percent: plan.monthlyCredits === 0 ? 0 : Math.min(Math.round((used / plan.monthlyCredits) * 100), 100) };
}

export function canUseAi(tenantId: string, units: number): boolean { return getUsageSnapshot(tenantId).used + units <= getUsageSnapshot(tenantId).limit; }

export function getTenantSubscriptionRecord(tenantId: string): { planId: PlanId; status: string; subscriptionSource: 'trial'|'manual'|'mercado_pago'; assignedByPlatformAdminId: string | null; assignmentNote: string } {
  ensureTenantPlan(tenantId);
  const rowData = row<{ plan_id: PlanId; status: string; subscription_source: 'trial'|'manual'|'mercado_pago'; assigned_by_platform_admin_id: string | null; assignment_note: string }>(db.prepare('SELECT plan_id,status,subscription_source,assigned_by_platform_admin_id,assignment_note FROM tenant_subscriptions WHERE tenant_id=?'), tenantId);
  return { planId: rowData?.plan_id ?? 'free', status: rowData?.status ?? 'active', subscriptionSource: rowData?.subscription_source ?? 'trial', assignedByPlatformAdminId: rowData?.assigned_by_platform_admin_id ?? null, assignmentNote: rowData?.assignment_note ?? '' };
}

export function changeTenantPlan(tenantId: string, planId: PlanId): void {
  const current = getTenantSubscriptionRecord(tenantId);
  if (current.subscriptionSource === 'manual') throw new Error('El plan de esta empresa está administrado manualmente por EMPRE.IA.');
  getPlanDefinition(planId);
  ensureTenantPlan(tenantId, planId);
  db.prepare("UPDATE tenant_subscriptions SET plan_id=?,status='active',subscription_source='mercado_pago',assigned_by_platform_admin_id=NULL,assignment_note='',updated_at=? WHERE tenant_id=?").run(planId, nowIso(), tenantId);
}

export function assignTenantPlanManually(tenantId: string, planId: PlanId, platformAdminId: string, note = ''): void {
  getPlanDefinition(planId);
  ensureTenantPlan(tenantId, planId);
  const now = nowIso();
  db.prepare("UPDATE tenant_subscriptions SET plan_id=?,status='active',subscription_source='manual',assigned_by_platform_admin_id=?,assignment_note=?,started_at=?,updated_at=? WHERE tenant_id=?")
    .run(planId, platformAdminId, note.trim().slice(0, 500), now, now, tenantId);
}

function periodEnd(cycle: BillingCycle, from = new Date()) {
  const result = new Date(from);
  if (cycle === 'annual') result.setFullYear(result.getFullYear() + 1);
  else result.setMonth(result.getMonth() + 1);
  return result.toISOString();
}

function activateTenantPlanFromPayment(tenantId: string, planId: PlanId, cycle: BillingCycle): void {
  const now = nowIso();
  db.prepare("UPDATE tenant_subscriptions SET plan_id=?,status='active',started_at=?,period_ends_at=?,subscription_source='mercado_pago',assigned_by_platform_admin_id=NULL,assignment_note='',updated_at=? WHERE tenant_id=?")
    .run(planId, now, periodEnd(cycle), now, tenantId);
}

export function ensureTenantAiFoundation(tenantId: string): void {
  const now = nowIso();
  db.prepare(`
    INSERT OR IGNORE INTO ai_profiles
      (tenant_id,objective,operating_mode,autonomy_level,provider,model,memory_mode,data_policy,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(tenantId, EMPRE_IDENTITY.purpose, 'supervised', 'approval-required', 'pending', 'pending', 'tenant-scoped', 'minimize-and-redact', now);

  for (const rule of EMPRE_POLICY_DEFAULTS) {
    db.prepare(`INSERT OR IGNORE INTO policy_rules (id,tenant_id,action_key,effect,requires_approval,enabled,created_at) VALUES (?,?,?,?,?,?,?)`)
      .run(id('policy'), tenantId, rule.key, rule.effect, rule.requiresApproval ? 1 : 0, 1, now);
  }
}

export function ensureSeedPlans(): void {
  for (const plan of PLAN_DEFINITIONS) {
    db.prepare(`
      INSERT INTO plan_catalog (id,name,monthly_cop,annual_cop,monthly_credits,ai_level,integrations_limit,summary,highlights_json,active,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,1,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, monthly_cop=excluded.monthly_cop, annual_cop=excluded.annual_cop,
        monthly_credits=excluded.monthly_credits, ai_level=excluded.ai_level,
        integrations_limit=excluded.integrations_limit, summary=excluded.summary,
        highlights_json=excluded.highlights_json, updated_at=excluded.updated_at
    `).run(plan.id, plan.name, plan.monthlyCop, plan.annualCop, plan.monthlyCredits, plan.aiLevel, plan.integrationsLimit, plan.summary, JSON.stringify(plan.highlights), nowIso(), nowIso());
  }
  for (const tenant of rows<{ id: string }>(db.prepare('SELECT id FROM tenants'))) {
    ensureTenantPlan(tenant.id);
    ensureTenantAiFoundation(tenant.id);
  }
}

export function ensureSeedCoreData(): void { ensureSeedPlans(); }

export type BillingCycle = 'monthly' | 'annual';

export interface BillingProviderStatus {
  readonly provider: 'mercado-pago';
  readonly configured: boolean;
  readonly environment: 'sandbox' | 'production' | 'unconfigured';
  readonly hasPaymentLink: boolean;
  readonly method: 'checkout-pro-orders' | 'payment-link' | 'unconfigured';
  readonly message: string;
}

export function getBillingProviderStatus(): BillingProviderStatus {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  const publicUrl = process.env.EMPRE_PUBLIC_WEB_URL?.trim();
  const paymentLink = process.env.MERCADOPAGO_PAYMENT_LINK?.trim();
  const explicitEnvironment = process.env.MERCADOPAGO_ENVIRONMENT?.trim().toLowerCase();
  const environment: BillingProviderStatus['environment'] = explicitEnvironment === 'test' || explicitEnvironment === 'sandbox'
    ? 'sandbox'
    : explicitEnvironment === 'production'
      ? 'production'
      : 'unconfigured';
  const environmentConfigured = environment !== 'unconfigured';
  const configured = Boolean(token && publicUrl && environmentConfigured && /^https?:\/\//i.test(publicUrl) && (process.env.NODE_ENV !== 'production' || /^https:\/\//i.test(publicUrl)));
  const method = configured ? 'checkout-pro-orders' : paymentLink ? 'payment-link' : 'unconfigured';
  return {
    provider: 'mercado-pago', configured: configured || Boolean(paymentLink), environment,
    hasPaymentLink: Boolean(paymentLink), method,
    message: configured
      ? 'Mercado Pago está listo para Checkout Pro mediante Orders API. Los secretos permanecen sólo en el servidor.'
      : paymentLink
        ? 'Hay un Link de Pago configurado. Sirve como respaldo manual; no permite que EMPRE identifique y active automáticamente el plan de cada empresa.'
        : 'Mercado Pago no está configurado. Añade Access Token, MERCADOPAGO_ENVIRONMENT=test|production y una URL pública HTTPS en el servidor.',
  };
}

export async function getOrCreateMercadoPagoCheckout(tenantId: string, planId: PlanId, cycle: BillingCycle, payerEmail: string): Promise<{ checkoutUrl: string; providerOrderId: string | null; checkoutMethod: 'checkout-pro-orders' | 'payment-link'; automaticActivation: boolean; checkoutId: string }> {
  const status = getBillingProviderStatus();
  if (planId === 'free') throw new Error('El plan Free no requiere pago.');
  const existing = row<{ id: string; checkout_url: string; provider_order_id: string | null; checkout_method: 'checkout-pro-orders' | 'payment-link' }>(db.prepare(`SELECT id,checkout_url,provider_order_id,checkout_method FROM billing_checkout_sessions WHERE tenant_id=? AND plan_id=? AND billing_cycle=? AND provider='mercado-pago' AND status IN ('created','started','pending') ORDER BY created_at DESC LIMIT 1`), tenantId, planId, cycle);
  if (existing?.checkout_url) return { checkoutUrl: existing.checkout_url, providerOrderId: existing.provider_order_id, checkoutMethod: existing.checkout_method, automaticActivation: existing.checkout_method === 'checkout-pro-orders', checkoutId: existing.id };

  const checkoutId = id('checkout');
  if (status.method === 'payment-link') {
    const now = nowIso();
    db.prepare(`INSERT INTO billing_checkout_sessions (id,tenant_id,provider,plan_id,billing_cycle,checkout_url,checkout_method,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(checkoutId, tenantId, 'mercado-pago', planId, cycle, process.env.MERCADOPAGO_PAYMENT_LINK!.trim(), 'payment-link', 'pending', now, now);
    return { checkoutUrl: process.env.MERCADOPAGO_PAYMENT_LINK!.trim(), providerOrderId: null, checkoutMethod: 'payment-link', automaticActivation: false, checkoutId };
  }
  if (!status.configured) throw new Error('Mercado Pago no está configurado en el servidor.');
  if (!payerEmail.includes('@')) throw new Error('No se pudo identificar el correo del comprador.');

  const plan = getPlanDefinition(planId);
  const amount = cycle === 'annual' ? plan.annualCop : plan.monthlyCop;
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('El precio del plan no es válido.');
  const publicUrl = process.env.EMPRE_PUBLIC_WEB_URL!.trim().replace(/\/$/, '');
  const externalReference = `EMPRE-${checkoutId}`.slice(0, 64);
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN!.trim()}`,
      'content-type': 'application/json',
      'X-Idempotency-Key': checkoutId,
    },
    body: JSON.stringify({
      type: 'online',
      processing_mode: 'manual',
      total_amount: amount.toFixed(2),
      external_reference: externalReference,
      description: `EMPRE.IA ${plan.name} · ${cycle === 'annual' ? 'Plan anual' : 'Plan mensual'}`,
      payer: { email: payerEmail },
      items: [{ title: `EMPRE.IA ${plan.name} (${cycle === 'annual' ? 'anual' : 'mensual'})`, unit_price: amount.toFixed(2), quantity: 1, unit_measure: 'unit', total_amount: amount.toFixed(2) }],
      config: { online: { success_url: `${publicUrl}/?billing=success&checkout=${encodeURIComponent(checkoutId)}`, failure_url: `${publicUrl}/?billing=failure&checkout=${encodeURIComponent(checkoutId)}`, pending_url: `${publicUrl}/?billing=pending&checkout=${encodeURIComponent(checkoutId)}`, auto_return: 'approved' } },
      expiration_time: 'P1D',
    }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : `Mercado Pago respondió HTTP ${response.status}.`;
    throw new Error(message);
  }
  const providerOrderId = String(data.id ?? '');
  const checkoutUrl = String(data.checkout_url ?? '');
  if (!providerOrderId || !checkoutUrl) throw new Error('Mercado Pago no devolvió una order o checkout_url válido.');
  const now = nowIso();
  db.prepare(`INSERT INTO billing_checkout_sessions (id,tenant_id,provider,plan_id,billing_cycle,provider_order_id,checkout_url,checkout_method,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(checkoutId, tenantId, 'mercado-pago', planId, cycle, providerOrderId, checkoutUrl, 'checkout-pro-orders', 'created', now, now);
  return { checkoutUrl, providerOrderId, checkoutMethod: 'checkout-pro-orders', automaticActivation: true, checkoutId };
}


export async function getMercadoPagoPaymentMethods() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN para consultar los medios de pago.');
  const response = await fetch('https://api.mercadopago.com/v1/payment_methods', { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(typeof data === 'object' && data !== null && 'message' in data ? String((data as { message?: unknown }).message) : `Mercado Pago respondió HTTP ${response.status}.`);
  return Array.isArray(data)
    ? data.filter((item) => item && typeof item === 'object').map((item) => {
        const value = item as Record<string, unknown>;
        const additionalInfo = Array.isArray(value.additional_info_needed) ? value.additional_info_needed.map(String) : [];
        return {
          id: String(value.id ?? ''),
          name: String(value.name ?? ''),
          type: String(value.payment_type_id ?? ''),
          status: String(value.status ?? ''),
          additionalInfo,
          isPse: String(value.id ?? '').toLowerCase() === 'pse' || String(value.payment_type_id ?? '').toLowerCase() === 'bank_transfer',
        };
      }).filter((item) => item.id && item.name)
    : [];
}

export async function syncMercadoPagoOrder(providerOrderId: string): Promise<{ status: string; statusDetail: string; activated: boolean }> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN.');
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(providerOrderId)}`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  const order = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof order.message === 'string' ? order.message : `No se pudo consultar la order ${providerOrderId}.`);
  const status = String(order.status ?? 'unknown');
  const statusDetail = String(order.status_detail ?? 'unknown');
  const checkout = row<{ tenant_id: string; plan_id: PlanId; billing_cycle: BillingCycle }>(db.prepare('SELECT tenant_id,plan_id,billing_cycle FROM billing_checkout_sessions WHERE provider_order_id=?'), providerOrderId);
  if (!checkout) throw new Error('La order de Mercado Pago no corresponde a una compra registrada en EMPRE.IA.');
  const now = nowIso();
  if (status === 'processed' && statusDetail === 'accredited') {
    db.prepare("UPDATE billing_checkout_sessions SET status='completed',updated_at=? WHERE provider_order_id=?").run(now, providerOrderId);
    activateTenantPlanFromPayment(checkout.tenant_id, checkout.plan_id, checkout.billing_cycle);
    return { status, statusDetail, activated: true };
  }
  if (status === 'processing' || status === 'action_required' || status === 'created') {
    db.prepare("UPDATE billing_checkout_sessions SET status='pending',updated_at=? WHERE provider_order_id=?").run(now, providerOrderId);
  } else if (status === 'failed' || status === 'canceled' || status === 'refunded') {
    db.prepare("UPDATE billing_checkout_sessions SET status='failed',updated_at=? WHERE provider_order_id=?").run(now, providerOrderId);
  }
  return { status, statusDetail, activated: false };
}
