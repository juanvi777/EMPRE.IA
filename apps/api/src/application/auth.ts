import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, nowIso, row, type AppUser } from '../infrastructure/db/database.js';
import { ensureTenantAiFoundation, ensureTenantPlan } from './billing.js';

export interface LoginInput { readonly email: string; readonly password: string; }
export interface PlatformAdmin { readonly id: 'primary'; readonly name: string; readonly email: string; readonly status: 'active'; }
export interface RegisterInput { readonly companyName: string; readonly name: string; readonly email: string; readonly password: string; readonly countryCode?: string; readonly businessType?: 'legal_entity'|'natural_person'|'informal'; readonly legalRegistered?: boolean; readonly legalName?: string; readonly nit?: string; readonly nitDv?: string; readonly taxDeclaration?: 'obligated'|'not_obligated'|'unknown'; }

function id(prefix: string): string { return `${prefix}_${randomBytes(10).toString('hex')}`; }
function normalizeEmail(value: string): string { return value.trim().toLowerCase(); }
function slugify(value: string): string {
  const slug = value.toLocaleLowerCase('es').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || `empresa-${randomBytes(4).toString('hex')}`;
}
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}
function verifyPassword(password: string, encoded: string): boolean {
  const [scheme, salt, expectedHex] = encoded.split(':');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }

export function ensurePlatformAdminFromEnv(): void {
  const existing = row<{ id: string }>(db.prepare("SELECT id FROM platform_admins WHERE id='primary'"));
  if (existing) return;
  const email = normalizeEmail(process.env.EMPRE_PLATFORM_ADMIN_EMAIL ?? '');
  const password = process.env.EMPRE_PLATFORM_ADMIN_PASSWORD ?? '';
  const name = (process.env.EMPRE_PLATFORM_ADMIN_NAME ?? 'Propietario EMPRE.IA').trim();
  if (!email || !password) return;
  if (password.length < 12) throw new Error('EMPRE_PLATFORM_ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  const now = nowIso();
  db.prepare('INSERT INTO platform_admins (id,name,email,password_hash,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run('primary', name, email, hashPassword(password), 'active', now, now);
}

export function platformLogin(input: LoginInput): { token: string; admin: PlatformAdmin } {
  const email = normalizeEmail(input.email);
  const admin = row<{ id: 'primary'; name: string; email: string; password_hash: string; status: string }>(db.prepare("SELECT id,name,email,password_hash,status FROM platform_admins WHERE id='primary' AND email=?"), email);
  if (!admin || admin.status !== 'active' || !verifyPassword(input.password, admin.password_hash)) throw new Error('Correo o contraseña de propietario incorrectos.');
  const token = `plat_${randomBytes(32).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  db.prepare('INSERT INTO platform_sessions (id,token_hash,platform_admin_id,expires_at,created_at) VALUES (?,?,?,?,?)')
    .run(id('platform-session'), tokenHash(token), 'primary', expiresAt, nowIso());
  return { token, admin: { id: 'primary', name: admin.name, email: admin.email, status: 'active' } };
}

export function getPlatformAdminFromToken(token: string): PlatformAdmin | undefined {
  const session = row<{ platform_admin_id: string; expires_at: string }>(db.prepare('SELECT platform_admin_id,expires_at FROM platform_sessions WHERE token_hash=?'), tokenHash(token));
  if (!session || session.platform_admin_id !== 'primary' || new Date(session.expires_at).getTime() <= Date.now()) return undefined;
  return row<PlatformAdmin>(db.prepare("SELECT id,name,email,status FROM platform_admins WHERE id='primary' AND status='active'")) as PlatformAdmin | undefined;
}

export function platformLogout(token: string): void {
  db.prepare('DELETE FROM platform_sessions WHERE token_hash=?').run(tokenHash(token));
}

export function register(input: RegisterInput): AppUser {
  const companyName = input.companyName.trim();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (companyName.length < 2) throw new Error('El nombre de la empresa es obligatorio.');
  if (name.length < 2) throw new Error('El nombre es obligatorio.');
  if (!email.includes('@')) throw new Error('Correo inválido.');
  if (input.password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

  const legalRegistered = input.legalRegistered ?? false;
  const businessType = input.businessType ?? (legalRegistered ? 'legal_entity' : 'informal');
  const legalName = input.legalName?.trim() || (legalRegistered ? companyName : null);
  const nit = input.nit?.trim() || null;
  const nitDv = input.nitDv?.trim() || null;
  const taxDeclaration = input.taxDeclaration ?? 'unknown';
  if (legalRegistered && !legalName) throw new Error('Si la empresa está registrada formalmente, debes indicar la razón social o nombre legal.');
  if (legalRegistered && !nit) throw new Error('Si la empresa está registrada formalmente, debes indicar el NIT.');

  const existing = row<{ id: string }>(db.prepare('SELECT id FROM users WHERE email = ?'), email);
  if (existing) throw new Error('Ese correo ya está registrado.');

  const tenantId = id('tenant');
  const userId = id('user');
  const membershipId = id('membership');
  const now = nowIso();
  let slug = slugify(companyName);
  const collision = row<{ id: string }>(db.prepare('SELECT id FROM tenants WHERE slug = ?'), slug);
  if (collision) slug = `${slug}-${randomBytes(3).toString('hex')}`;

  db.exec('BEGIN');
  try {
    const nitVerificationStatus = legalRegistered && nit ? 'pending' : 'not_required';
    db.prepare(`INSERT INTO tenants (id,name,slug,created_at,country_code,business_type,legal_registered,legal_name,nit,nit_dv,nit_verification_status,tax_declaration,tax_responsibilities_json,legal_setup_completed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(tenantId, companyName, slug, now, (input.countryCode ?? 'CO').trim().toUpperCase().slice(0, 2), businessType, legalRegistered ? 1 : 0, legalName, nit, nitDv, nitVerificationStatus, taxDeclaration, '[]', 0);
    db.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)').run(userId, name, email, hashPassword(input.password), now);
    db.prepare('INSERT INTO memberships (id,tenant_id,user_id,role,created_at) VALUES (?,?,?,?,?)').run(membershipId, tenantId, userId, 'owner', now);
    seedTenant(tenantId);
    ensureTenantPlan(tenantId, 'free');
    ensureTenantAiFoundation(tenantId);
    audit(tenantId, userId, 'tenant.registered', 'tenant', tenantId, 'success', { companyName });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getUserContext(userId)!;
}

export function login(input: LoginInput): { token: string; user: AppUser } {
  const email = normalizeEmail(input.email);
  const user = row<{ id: string; password_hash: string; status: string }>(db.prepare('SELECT id,password_hash,status FROM users WHERE email = ?'), email);
  if (!user || user.status !== 'active' || !verifyPassword(input.password, user.password_hash)) {
    throw new Error('Correo o contraseña incorrectos.');
  }
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + 1000 * 60 * 60 * 12).toISOString();
  db.prepare('INSERT INTO sessions (id,token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?,?)').run(id('session'), tokenHash(token), user.id, expiresAt, nowIso());
  const context = getUserContext(user.id);
  if (!context) throw new Error('No se pudo cargar el usuario.');
  audit(context.tenantId, context.id, 'auth.login', 'user', context.id, 'success', {});
  return { token, user: context };
}

export function getUserFromToken(token: string): AppUser | undefined {
  const session = row<{ user_id: string; expires_at: string }>(db.prepare('SELECT user_id,expires_at FROM sessions WHERE token_hash = ?'), tokenHash(token));
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) return undefined;
  return getUserContext(session.user_id);
}

export function logout(token: string): void { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token)); }


export function hasPermission(userId: string, permission: string): boolean {
  const context = getUserContext(userId);
  if (!context) return false;
  const result = row<{ ok: number }>(db.prepare(`
    SELECT 1 AS ok
      FROM memberships m
      JOIN role_permissions rp ON rp.role = m.role
      JOIN permissions p ON p.id = rp.permission_id
     WHERE m.user_id = ? AND m.tenant_id = ? AND p.name = ?
     LIMIT 1
  `), userId, context.tenantId, permission);
  return Boolean(result?.ok);
}

export function getUserContext(userId: string): AppUser | undefined {
  return row<AppUser>(db.prepare(`SELECT u.id,m.tenant_id AS tenantId,t.name AS tenantName,u.name,u.email,m.role,u.status FROM users u JOIN memberships m ON m.user_id=u.id JOIN tenants t ON t.id=m.tenant_id WHERE u.id=?`), userId) as AppUser | undefined;
}

export function audit(tenantId: string, actorUserId: string | null, action: string, resourceType: string, resourceId: string | null, result: string, metadata: Record<string, unknown>): void {
  db.prepare('INSERT INTO audit_events (id,tenant_id,actor_user_id,action,resource_type,resource_id,result,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id('audit'), tenantId, actorUserId, action, resourceType, resourceId, result, JSON.stringify(metadata), nowIso());
}

function seedTenant(tenantId: string): void {
  const insertTask = db.prepare('INSERT INTO tasks (id,tenant_id,title,detail,created_at) VALUES (?,?,?,?,?)');
  const insertAgent = db.prepare('INSERT INTO agents (id,tenant_id,name,description,created_at) VALUES (?,?,?,?,?)');
  const insertAutomation = db.prepare('INSERT INTO automations (id,tenant_id,name,description,created_at) VALUES (?,?,?,?,?)');
  const insertIntegration = db.prepare('INSERT INTO integrations (id,tenant_id,name,kind,created_at) VALUES (?,?,?,?,?)');
  const insertClient = db.prepare('INSERT INTO clients (id,tenant_id,name,email,status,created_at) VALUES (?,?,?,?,?,?)');
  const insertDocument = db.prepare('INSERT INTO documents (id,tenant_id,name,created_at) VALUES (?,?,?,?)');
  const now = nowIso();
  [
    ['Revisar clientes nuevos','3 pendientes'], ['Generar informe mensual','Hoy'], ['Analizar oportunidades','5 pendientes'], ['Responder mensajes','12 pendientes'],
  ].forEach(([title, detail]) => insertTask.run(id('task'), tenantId, title, detail, now));
  [
    ['Asistente General','Responde y coordina tareas'], ['Analista de Ventas','Analiza datos del negocio'], ['Atención al Cliente','Gestiona solicitudes'], ['Gestor de Documentos','Procesa archivos'],
  ].forEach(([name, description]) => insertAgent.run(id('agent'), tenantId, name, description, now));
  [
    ['Resumen diario','Prepara un resumen operativo'], ['Aviso de nuevos clientes','Detecta nuevos registros'], ['Informe semanal','Genera un informe'],
  ].forEach(([name, description]) => insertAutomation.run(id('automation'), tenantId, name, description, now));
  [
    ['WhatsApp','whatsapp'], ['Email','email'], ['Google Drive','storage'], ['GitHub','code'], ['Sistema contable','accounting'],
  ].forEach(([name, kind]) => insertIntegration.run(id('integration'), tenantId, name, kind, now));
  [
    ['Sofía Martínez','sofia@empresa.local','active'], ['Carlos Gómez','carlos@empresa.local','active'], ['Laura Restrepo','laura@empresa.local','pending'], ['Andrés Ríos','andres@empresa.local','active'],
  ].forEach(([name, email, status]) => insertClient.run(id('client'), tenantId, name, email, status, now));
  ['Informe mensual.pdf','Manual operativo.docx','Contrato cliente.pdf'].forEach((name) => insertDocument.run(id('document'), tenantId, name, now));
}

export function seedIfEmpty(): void {
  const count = row<{ count: number }>(db.prepare('SELECT COUNT(*) AS count FROM tenants'));
  if ((count?.count ?? 0) > 0) return;
}
