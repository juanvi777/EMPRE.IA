import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isIP } from 'node:net';
import { db, nowIso, row, rows } from '../infrastructure/db/database.js';
import { getTenantPlan } from './billing.js';

export type ConnectorAuthMode = 'none' | 'login' | 'bearer' | 'api_key';
export type ConnectorStatus = 'draft' | 'testing' | 'connected' | 'error' | 'disabled';
export type ConnectorHttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ConnectorToolDefinition {
  name: string;
  method: ConnectorHttpMethod;
  path: string;
  readOnly: boolean;
  description?: string;
}

export interface ConnectorSummary {
  id: string;
  name: string;
  preset: string;
  baseUrl: string;
  authMode: ConnectorAuthMode;
  healthPath: string;
  verificationPath: string;
  loginPath: string;
  manifestPath: string;
  status: ConnectorStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
  tools: ConnectorToolDefinition[];
}

function id(prefix: string) { return `${prefix}_${randomBytes(10).toString('hex')}`; }

function encryptionKey(): Buffer {
  const configured = process.env.EMPRE_CONNECTOR_ENCRYPTION_KEY?.trim();
  if (configured) {
    const hex = Buffer.from(configured, 'hex');
    if (hex.length === 32) return hex;
    const base64 = Buffer.from(configured, 'base64');
    if (base64.length === 32) return base64;
    throw new Error('EMPRE_CONNECTOR_ENCRYPTION_KEY debe ser una clave de 32 bytes en hex o base64.');
  }
  const file = resolve(process.cwd(), '.data', '.connector-key');
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file)) return Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
  const key = randomBytes(32);
  writeFileSync(file, key.toString('hex'), { encoding: 'utf8' });
  return key;
}

function encryptSecret(value: string | null | undefined) {
  if (!value) return { ciphertext: null, iv: null, tag: null };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString('base64');
  return { ciphertext, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function decryptSecret(ciphertext: string | null, iv: string | null, tag: string | null): string | null {
  if (!ciphertext || !iv || !tag) return null;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

function normalizeBaseUrl(value: string) {
  const url = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) throw new Error('La URL base debe comenzar por http:// o https://');
  const parsed = new URL(url);
  if (parsed.username || parsed.password) throw new Error('No pongas usuario o contraseña dentro de la URL.');
  const privateNetworkAllowed = process.env.NODE_ENV !== 'production' || process.env.EMPRE_CONNECTOR_ALLOW_PRIVATE_NETWORK === 'true';
  const host = parsed.hostname.toLowerCase();
  const ip = isIP(host);
  const privateIp = (ip === 4 && (/^(10\.|127\.)/.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)))
    || (ip === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')));
  if (privateIp && !privateNetworkAllowed) throw new Error('Por seguridad, producción no permite conectar directamente a redes privadas o localhost. Usa un endpoint público HTTPS o habilita explícitamente la red privada.');
  if (parsed.protocol === 'http:' && process.env.NODE_ENV === 'production') throw new Error('En producción el Connector requiere HTTPS.');
  return url;
}

function safePath(path: string, fallback = '') {
  const value = (path || fallback).trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) throw new Error('Las rutas del Connector deben ser relativas a la URL base.');
  return value.startsWith('/') ? value : `/${value}`;
}

export function parseConnectorTools(value: unknown): ConnectorToolDefinition[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tools: ConnectorToolDefinition[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const name = String(raw.name ?? '').trim();
    const method = String(raw.method ?? 'GET').toUpperCase() as ConnectorHttpMethod;
    const path = String(raw.path ?? '').trim();
    if (!name || !path || !['GET','POST','PATCH','PUT','DELETE'].includes(method) || !path.startsWith('/') || /^https?:\/\//i.test(path) || seen.has(name)) continue;
    seen.add(name);
    tools.push({ name: name.slice(0, 100), method, path: path.slice(0, 300), readOnly: Boolean(raw.readOnly ?? method === 'GET'), description: raw.description ? String(raw.description).slice(0, 300) : undefined });
  }
  return tools.slice(0, 100);
}

function selectForTenant<T extends Record<string, unknown>>(tenantId: string) {
  return rows<T>(db.prepare('SELECT * FROM connectors WHERE tenant_id=? ORDER BY created_at DESC'), tenantId);
}

export function getConnectors(tenantId: string): ConnectorSummary[] { return selectForTenant<Record<string, unknown>>(tenantId).map(toSummary); }

function toSummary(item: Record<string, unknown>): ConnectorSummary {
  let tools: ConnectorToolDefinition[] = [];
  try { tools = parseConnectorTools(JSON.parse(String(item.tools_json ?? '[]'))); } catch { /* keep empty */ }
  return {
    id: String(item.id), name: String(item.name), preset: String(item.preset), baseUrl: String(item.base_url),
    authMode: item.auth_mode as ConnectorAuthMode, healthPath: String(item.health_path), verificationPath: String(item.verification_path),
    loginPath: String(item.login_path), manifestPath: String(item.manifest_path ?? ''), status: item.status as ConnectorStatus,
    lastCheckedAt: item.last_checked_at ? String(item.last_checked_at) : null, lastError: item.last_error ? String(item.last_error) : null, tools,
  };
}

export function getPrimaryConnector(tenantId: string): ConnectorSummary | null { return getConnectors(tenantId).find((item) => item.status === 'connected') ?? null; }
export function hasOperationalConnection(tenantId: string): boolean { return Boolean(getPrimaryConnector(tenantId)); }

export function createConnector(tenantId: string, input: {
  name?: string; preset?: string; baseUrl: string; authMode: ConnectorAuthMode; healthPath?: string; verificationPath?: string;
  loginPath?: string; manifestPath?: string; apiKeyHeader?: string; username?: string; secret?: string; tools?: unknown[];
}): ConnectorSummary {
  const plan = getTenantPlan(tenantId);
  const existingCount = Number(row<{ count: number }>(db.prepare("SELECT COUNT(*) AS count FROM connectors WHERE tenant_id=? AND status <> 'disabled'"), tenantId)?.count ?? 0);
  if (plan.integrationsLimit !== null && existingCount >= plan.integrationsLimit) throw new Error(`El plan ${plan.name} permite ${plan.integrationsLimit} integraciones. Cambia de plan para añadir otra.`);
  const name = (input.name?.trim() || 'Mi sistema').slice(0, 100);
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  if (input.authMode === 'login' && (!input.username?.trim() || !input.secret)) throw new Error('Para autenticación por inicio de sesión se requiere usuario/correo y contraseña.');
  if ((input.authMode === 'bearer' || input.authMode === 'api_key') && !input.secret) throw new Error('Falta la credencial del Connector.');
  const tools = parseConnectorTools(input.tools ?? []);
  const secret = encryptSecret(input.secret);
  const now = nowIso();
  const connectorId = id('connector');
  db.prepare(`INSERT INTO connectors (id,tenant_id,name,preset,base_url,auth_mode,health_path,verification_path,login_path,manifest_path,api_key_header,username,secret_ciphertext,secret_iv,secret_tag,tools_json,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    connectorId, tenantId, name, input.preset || 'generic_rest', baseUrl, input.authMode,
    safePath(input.healthPath, '/api/health'), safePath(input.verificationPath, '/api/me'), safePath(input.loginPath, '/api/auth/login'), safePath(input.manifestPath, ''),
    (input.apiKeyHeader?.trim() || 'x-api-key').slice(0, 80), input.username?.trim() || null, secret.ciphertext, secret.iv, secret.tag, JSON.stringify(tools), 'draft', now, now,
  );
  return getConnectors(tenantId).find((item) => item.id === connectorId)!;
}

function rawConnector(tenantId: string, connectorId: string) { return row<Record<string, unknown>>(db.prepare('SELECT * FROM connectors WHERE tenant_id=? AND id=?'), tenantId, connectorId); }

async function fetchJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(12_000), headers: { accept: 'application/json', ...(init.headers ?? {}) } });
  const text = await response.text(); let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 1000) }; }
  if (!response.ok) throw new Error(`El sistema respondió HTTP ${response.status}.`);
  return { response, data };
}

async function authHeaders(raw: Record<string, unknown>) {
  const mode = raw.auth_mode as ConnectorAuthMode;
  const secret = decryptSecret(raw.secret_ciphertext ? String(raw.secret_ciphertext) : null, raw.secret_iv ? String(raw.secret_iv) : null, raw.secret_tag ? String(raw.secret_tag) : null);
  if (mode === 'none') return {};
  if (mode === 'bearer') return secret ? { authorization: `Bearer ${secret}` } : {};
  if (mode === 'api_key') return secret ? { [String(raw.api_key_header || 'x-api-key')]: secret } : {};
  const username = raw.username ? String(raw.username) : '';
  if (!username || !secret) throw new Error('El Connector no tiene credenciales guardadas.');
  const { data } = await fetchJson(`${String(raw.base_url)}${String(raw.login_path)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: username, password: secret }) });
  const token = typeof data === 'object' && data !== null && 'token' in data && typeof (data as { token?: unknown }).token === 'string' ? (data as { token: string }).token : null;
  if (!token) throw new Error('El login del sistema no devolvió un token utilizable.');
  return { authorization: `Bearer ${token}` };
}

async function loadManifest(raw: Record<string, unknown>): Promise<ConnectorToolDefinition[] | null> {
  const path = String(raw.manifest_path ?? '').trim();
  if (!path) return null;
  const { data } = await fetchJson(`${String(raw.base_url)}${path}`, { method: 'GET', headers: await authHeaders(raw) });
  if (!data || typeof data !== 'object') throw new Error('El manifest no devolvió un objeto JSON.');
  const tools = parseConnectorTools((data as Record<string, unknown>).tools);
  if (!tools.length) throw new Error('El manifest no declara herramientas válidas.');
  return tools;
}

export async function testConnector(tenantId: string, connectorId: string) {
  const raw = rawConnector(tenantId, connectorId); if (!raw) throw new Error('Conector no encontrado.');
  db.prepare('UPDATE connectors SET status=?,last_error=NULL,updated_at=? WHERE tenant_id=? AND id=?').run('testing', nowIso(), tenantId, connectorId);
  try {
    const baseUrl = String(raw.base_url);
    await fetchJson(`${baseUrl}${String(raw.health_path)}`, { method: 'GET' });
    if (raw.auth_mode !== 'none') await fetchJson(`${baseUrl}${String(raw.verification_path)}`, { method: 'GET', headers: await authHeaders(raw) });
    const manifestTools = await loadManifest(raw);
    if (manifestTools) db.prepare('UPDATE connectors SET tools_json=?,updated_at=? WHERE tenant_id=? AND id=?').run(JSON.stringify(manifestTools), nowIso(), tenantId, connectorId);
    const checked = nowIso();
    db.prepare('UPDATE connectors SET status=?,last_checked_at=?,last_error=NULL,updated_at=? WHERE tenant_id=? AND id=?').run('connected', checked, checked, tenantId, connectorId);
    return { connector: getConnectors(tenantId).find((item) => item.id === connectorId)!, check: { health: true, verified: true, manifest: Boolean(manifestTools), message: 'Connector verificado y operativo.' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo verificar el Connector.';
    db.prepare('UPDATE connectors SET status=?,last_checked_at=?,last_error=?,updated_at=? WHERE tenant_id=? AND id=?').run('error', nowIso(), message.slice(0, 500), nowIso(), tenantId, connectorId);
    throw new Error(message);
  }
}

async function requestJson(tenantId: string, connectorId: string, tool: ConnectorToolDefinition, input: Record<string, unknown> = {}) {
  const raw = rawConnector(tenantId, connectorId);
  if (!raw || raw.status !== 'connected') throw new Error('El sistema externo no está conectado u operativo.');
  try {
    let path = tool.path; const remaining = { ...input };
    path = path.replace(/\{([a-zA-Z0-9_]+)\}|:([a-zA-Z0-9_]+)/g, (_m, a, b) => {
      const key = String(a ?? b); const value = remaining[key];
      if (value === undefined || value === null || String(value).trim() === '') throw new Error(`Falta el parámetro requerido: ${key}.`);
      delete remaining[key]; return encodeURIComponent(String(value));
    });
    const headers = { ...(await authHeaders(raw)) } as Record<string, string>;
    let url = `${String(raw.base_url)}${safePath(path, '/')}`; const init: RequestInit = { method: tool.method, headers };
    if (tool.method === 'GET') {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(remaining)) if (value !== undefined && value !== null) query.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      const suffix = query.toString(); if (suffix) url += `?${suffix}`;
    } else {
      headers['content-type'] = 'application/json'; init.body = JSON.stringify(remaining);
    }
    return (await fetchJson(url, init)).data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falló la comunicación con el sistema externo.';
    db.prepare('UPDATE connectors SET status=?,last_checked_at=?,last_error=?,updated_at=? WHERE tenant_id=? AND id=?').run('error', nowIso(), message.slice(0, 500), nowIso(), tenantId, connectorId);
    throw error;
  }
}

export function getConnectorTools(tenantId: string): ConnectorToolDefinition[] { return getPrimaryConnector(tenantId)?.tools ?? []; }

export async function connectorProbe(tenantId: string) {
  const connector = getPrimaryConnector(tenantId); if (!connector) throw new Error('No hay un Connector operativo. Conecta primero el sistema de tu empresa.');
  const raw = rawConnector(tenantId, connector.id); if (!raw) throw new Error('El Connector operativo ya no existe.');
  try {
    const verification = raw.auth_mode === 'none' ? null : await fetchJson(`${String(raw.base_url)}${String(raw.verification_path)}`, { method: 'GET', headers: await authHeaders(raw) });
    const manifestTools = await loadManifest(raw);
    if (manifestTools) db.prepare('UPDATE connectors SET tools_json=?,last_checked_at=?,last_error=NULL,updated_at=? WHERE tenant_id=? AND id=?').run(JSON.stringify(manifestTools), nowIso(), nowIso(), tenantId, connector.id);
    else db.prepare('UPDATE connectors SET last_checked_at=?,last_error=NULL,updated_at=? WHERE tenant_id=? AND id=?').run(nowIso(), nowIso(), tenantId, connector.id);
    return { connector: getConnectors(tenantId).find((item) => item.id === connector.id), capabilities: ['health', ...(verification ? ['identity'] : []), ...(manifestTools ? ['manifest'] : [])], tools: manifestTools ?? connector.tools, me: verification?.data ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'La prueba del Connector falló.';
    db.prepare('UPDATE connectors SET status=?,last_checked_at=?,last_error=?,updated_at=? WHERE tenant_id=? AND id=?').run('error', nowIso(), message.slice(0, 500), nowIso(), tenantId, connector.id);
    throw new Error(`La conexión dejó de ser operativa: ${message}`);
  }
}

export async function executeConnectorTool(tenantId: string, toolName: string, input: Record<string, unknown> = {}) {
  const connector = getPrimaryConnector(tenantId); if (!connector) throw new Error('Necesitas un Connector operativo.');
  const tool = connector.tools.find((item) => item.name === toolName); if (!tool) throw new Error(`La herramienta '${toolName}' no está declarada por la conexión.`);
  return requestJson(tenantId, connector.id, tool, input);
}
