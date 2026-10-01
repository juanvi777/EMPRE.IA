import type { AgentName } from './agent-types.js';
import { AGENTS } from './agent-registry.js';

const normalize = (value: string) => value.toLocaleLowerCase('es-CO').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function routeToAgent(message: string): AgentName {
  const text = normalize(message.trim());
  if (/\b(investiga|busca|fuentes|actualidad|noticias|web|internet)\b/.test(text)) return 'research';
  if (/\b(ventas?|ingresos?|pedidos?|facturas?)\b/.test(text) && /\b(analiza|revisa|compar|resumen|cuanto|cuantas|total)\b/.test(text)) return 'sales';
  if (/\b(clientes?|clientas?)\b/.test(text)) return 'customers';
  if (/\b(cita|citas|agenda|reservas?)\b/.test(text)) return 'appointments';
  if (/\b(documento|documentos|contrato|contratos|pdf|factura)\b/.test(text)) return 'documents';
  if (/\b(automatiz|flujo|workflow)\b/.test(text)) return 'automation';
  if (/\b(error|fallo|falla|sistema|servidor|latencia|salud)\b/.test(text)) return 'system';
  if (/\b(conectar|conexi[oó]n|integrar|integracion|api|connector)\b/.test(text)) return 'connector';
  if (/\b(permiso|seguridad|autoriza|aprobacion|riesgo)\b/.test(text)) return 'security';
  return 'general';
}

export function agentRequiresConnector(agentName: AgentName): boolean {
  return Boolean(AGENTS.find((agent) => agent.name === agentName)?.requiresConnector);
}
