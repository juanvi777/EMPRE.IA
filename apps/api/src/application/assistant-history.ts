import { randomBytes } from 'node:crypto';
import { db, nowIso, rows } from '../infrastructure/db/database.js';

function id(prefix: string): string { return `${prefix}_${randomBytes(10).toString('hex')}`; }

export type AssistantMessage = { id: string; role: 'user' | 'assistant'; text: string; created_at: string };

export function getAssistantHistory(tenantId: string, userId: string, limit = 16): AssistantMessage[] {
  const bounded = Math.max(1, Math.min(limit, 40));
  const result = rows<AssistantMessage>(db.prepare(`
    SELECT id, role, text, created_at
      FROM assistant_messages
     WHERE tenant_id=? AND user_id=?
     ORDER BY created_at DESC
     LIMIT ${bounded}
  `), tenantId, userId);
  return result.reverse();
}

export function appendAssistantMessage(tenantId: string, userId: string, role: 'user' | 'assistant', text: string): void {
  const clean = text.trim().slice(0, 12_000);
  if (!clean) return;
  db.prepare(`INSERT INTO assistant_messages (id,tenant_id,user_id,role,text,created_at) VALUES (?,?,?,?,?,?)`)
    .run(id('msg'), tenantId, userId, role, clean, nowIso());
}

export function clearAssistantHistory(tenantId: string, userId: string): void {
  db.prepare('DELETE FROM assistant_messages WHERE tenant_id=? AND user_id=?').run(tenantId, userId);
}
