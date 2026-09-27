import { db, rows, row } from '../infrastructure/db/database.js';
import { getTenantPlan, getUsageSnapshot } from './billing.js';
import { getConnectors, getPrimaryConnector, hasOperationalConnection } from './connectors.js';

export function getDashboardSummary(tenantId: string) {
  const scalar = (sql: string) => Number(row<{ count: number }>(db.prepare(sql), tenantId)?.count ?? 0);
  const tenant = row<{ name: string }>(db.prepare('SELECT name FROM tenants WHERE id = ?'), tenantId);
  const plan = getTenantPlan(tenantId);
  return {
    tenantName: tenant?.name ?? 'Mi empresa',
    plan: {
      id: plan.id,
      name: plan.name,
      aiLevel: plan.aiLevel,
      monthlyCredits: plan.monthlyCredits,
      integrationsLimit: plan.integrationsLimit,
    },
    usage: getUsageSnapshot(tenantId),
    clients: scalar('SELECT COUNT(*) AS count FROM clients WHERE tenant_id = ?'),
    tasks: scalar("SELECT COUNT(*) AS count FROM tasks WHERE tenant_id = ? AND status = 'pending'"),
    agents: scalar("SELECT COUNT(*) AS count FROM agents WHERE tenant_id = ? AND status = 'active'"),
    automations: scalar("SELECT COUNT(*) AS count FROM automations WHERE tenant_id = ? AND status = 'active'"),
    integrations: rows<{ id:string; name:string; kind:string; status:string }>(db.prepare('SELECT id,name,kind,status FROM integrations WHERE tenant_id = ? ORDER BY name'), tenantId),
    connection: { connected: hasOperationalConnection(tenantId), primary: getPrimaryConnector(tenantId), connectors: getConnectors(tenantId) },
    recentTasks: rows<{ id:string; title:string; detail:string; status:string }>(db.prepare('SELECT id,title,detail,status FROM tasks WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 8'), tenantId),
    agentsList: rows<{ id:string; name:string; description:string; status:string }>(db.prepare('SELECT id,name,description,status FROM agents WHERE tenant_id = ? ORDER BY name'), tenantId),
    automationsList: rows<{ id:string; name:string; description:string; status:string }>(db.prepare('SELECT id,name,description,status FROM automations WHERE tenant_id = ? ORDER BY name'), tenantId),
    clientsList: rows<{ id:string; name:string; email:string; status:string }>(db.prepare('SELECT id,name,email,status FROM clients WHERE tenant_id = ? ORDER BY name'), tenantId),
    documentsList: rows<{ id:string; name:string; status:string }>(db.prepare('SELECT id,name,status FROM documents WHERE tenant_id = ? ORDER BY created_at DESC'), tenantId),
  };
}

export function updateTask(tenantId: string, taskId: string, status: 'pending'|'done'): boolean {
  const result = db.prepare('UPDATE tasks SET status=? WHERE id=? AND tenant_id=?').run(status, taskId, tenantId);
  return Number(result.changes ?? 0) > 0;
}

export function updateAgent(tenantId: string, id: string, status: 'active'|'paused'): boolean {
  const result = db.prepare('UPDATE agents SET status=? WHERE id=? AND tenant_id=?').run(status, id, tenantId);
  return Number(result.changes ?? 0) > 0;
}

export function updateAutomation(tenantId: string, id: string, status: 'active'|'paused'): boolean {
  const result = db.prepare('UPDATE automations SET status=? WHERE id=? AND tenant_id=?').run(status, id, tenantId);
  return Number(result.changes ?? 0) > 0;
}
