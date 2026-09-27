import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

export type SqlValue = string | number | bigint | null | Uint8Array;

export interface AppUser {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly name: string;
  readonly email: string;
  readonly role: 'owner' | 'admin' | 'operator' | 'viewer';
  readonly status: 'active';
}

const configuredPath = process.env.EMPRE_DB_PATH;
const railwayVolumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
const defaultDataDirectory = railwayVolumePath || resolve(process.cwd(), '.data');
const defaultPath = process.env.NODE_ENV === 'test' ? ':memory:' : resolve(defaultDataDirectory, 'empreia.sqlite');
const databasePath = configuredPath === ':memory:' ? ':memory:' : (configuredPath ? resolve(configuredPath) : defaultPath);

if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','operator','viewer')),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role, permission_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  result TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','disabled')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','processing')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_cop INTEGER NOT NULL DEFAULT 0,
  annual_cop INTEGER NOT NULL DEFAULT 0,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  ai_level TEXT NOT NULL CHECK (ai_level IN ('basic','advanced')),
  integrations_limit INTEGER,
  summary TEXT NOT NULL,
  highlights_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_admins (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  platform_admin_id TEXT NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plan_catalog(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trial','active','past_due','cancelled')),
  started_at TEXT NOT NULL,
  period_ends_at TEXT,
  updated_at TEXT NOT NULL,
  subscription_source TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_source IN ('trial','manual','mercado_pago')),
  assigned_by_platform_admin_id TEXT REFERENCES platform_admins(id) ON DELETE SET NULL,
  assignment_note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (units > 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_profiles (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  operating_mode TEXT NOT NULL DEFAULT 'supervised',
  autonomy_level TEXT NOT NULL DEFAULT 'approval-required',
  provider TEXT NOT NULL DEFAULT 'pending',
  model TEXT NOT NULL DEFAULT 'pending',
  memory_mode TEXT NOT NULL DEFAULT 'tenant-scoped',
  data_policy TEXT NOT NULL DEFAULT 'minimize-and-redact',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('allow','approval','deny')),
  requires_approval INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, action_key)
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_user_time
  ON assistant_messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','failed')),
  result_json TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS billing_checkout_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES plan_catalog(id),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  provider_plan_id TEXT,
  provider_order_id TEXT,
  checkout_url TEXT,
  checkout_method TEXT NOT NULL DEFAULT 'order',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','started','completed','cancelled','failed','pending')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  preset TEXT NOT NULL DEFAULT 'generic_rest',
  base_url TEXT NOT NULL,
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('none','login','bearer','api_key')),
  health_path TEXT NOT NULL DEFAULT '/api/health',
  verification_path TEXT NOT NULL DEFAULT '/api/me',
  login_path TEXT NOT NULL DEFAULT '/api/auth/login',
  manifest_path TEXT NOT NULL DEFAULT '',
  api_key_header TEXT NOT NULL DEFAULT 'x-api-key',
  username TEXT,
  secret_ciphertext TEXT,
  secret_iv TEXT,
  secret_tag TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','testing','connected','error','disabled')),
  last_checked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, name)
);
`);

function addColumnIfMissing(table: string, column: string, definition: string): void {
  const columns = rows<{ name: string }>(db.prepare(`PRAGMA table_info(${table})`));
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Migraciones aditivas para instalaciones 0.3.0 anteriores. No eliminamos ni reescribimos datos existentes.
addColumnIfMissing('tenants', 'country_code', "TEXT NOT NULL DEFAULT 'CO'");
addColumnIfMissing('tenants', 'business_type', "TEXT NOT NULL DEFAULT 'legal_entity'");
addColumnIfMissing('tenants', 'legal_registered', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('tenants', 'legal_name', 'TEXT');
addColumnIfMissing('tenants', 'nit', 'TEXT');
addColumnIfMissing('tenants', 'nit_dv', 'TEXT');
addColumnIfMissing('tenants', 'nit_verification_status', "TEXT NOT NULL DEFAULT 'not_required'");
addColumnIfMissing('tenants', 'tax_declaration', "TEXT NOT NULL DEFAULT 'unknown'");
addColumnIfMissing('tenants', 'tax_responsibilities_json', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('tenants', 'legal_setup_completed', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('tenant_subscriptions', 'period_ends_at', 'TEXT');
addColumnIfMissing('billing_checkout_sessions', 'provider_order_id', 'TEXT');
addColumnIfMissing('billing_checkout_sessions', 'checkout_method', "TEXT NOT NULL DEFAULT 'order'");
addColumnIfMissing('tenant_subscriptions', 'subscription_source', "TEXT NOT NULL DEFAULT 'trial'");
addColumnIfMissing('tenant_subscriptions', 'assigned_by_platform_admin_id', 'TEXT');
addColumnIfMissing('tenant_subscriptions', 'assignment_note', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('connectors', 'manifest_path', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('connectors', 'tools_json', "TEXT NOT NULL DEFAULT '[]'");

const permissionSeeds = [
  'dashboard.read',
  'clients.read',
  'tasks.read',
  'tasks.write',
  'agents.read',
  'agents.write',
  'automations.read',
  'automations.write',
  'integrations.read',
  'audit.read',
  'assistant.use',
  'core.read',
  'plans.read',
  'plans.write',
  'usage.read',
  'settings.ai.write',
  'company.read',
  'company.write',
  'billing.read',
  'billing.write',
  'connectors.read',
  'connectors.write',
  'tools.execute',
] as const;

const seedPermission = db.prepare('INSERT OR IGNORE INTO permissions (id, name) VALUES (?, ?)');
for (const permission of permissionSeeds) {
  seedPermission.run(`perm-${permission}`, permission);
}

const roleMatrix: Record<string, string[]> = {
  owner: [...permissionSeeds],
  admin: [...permissionSeeds],
  operator: ['dashboard.read','clients.read','tasks.read','tasks.write','agents.read','agents.write','automations.read','automations.write','integrations.read','assistant.use','core.read','plans.read','usage.read','connectors.read'],
  viewer: ['dashboard.read','clients.read','tasks.read','agents.read','automations.read','integrations.read','assistant.use','core.read','plans.read','company.read','billing.read','connectors.read'],
};
const roleInsert = db.prepare('INSERT OR IGNORE INTO role_permissions (role, permission_id) VALUES (?, ?)');
for (const [role, permissions] of Object.entries(roleMatrix)) {
  for (const permission of permissions) roleInsert.run(role, `perm-${permission}`);
}

export function row<T extends Record<string, unknown>>(statement: StatementSync, ...params: SqlValue[]): T | undefined {
  return statement.get(...params) as T | undefined;
}

export function rows<T extends Record<string, unknown>>(statement: StatementSync, ...params: SqlValue[]): T[] {
  return statement.all(...params) as T[];
}

export function nowIso(): string {
  return new Date().toISOString();
}
