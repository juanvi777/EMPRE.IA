import type { AgentDescriptor, AgentName } from './agent-types.js';

export const AGENTS: readonly AgentDescriptor[] = [
  { name: 'general', title: 'Agente General', description: 'Conversación, razonamiento y ayuda general.', triggers: ['saludo', 'pregunta general', 'matemáticas', 'explicación'], requiresConnector: false },
  { name: 'research', title: 'Agente de Investigación', description: 'Investigación web y síntesis de fuentes.', triggers: ['investiga', 'busca', 'actualidad', 'fuentes'], requiresConnector: false },
  { name: 'sales', title: 'Agente de Ventas', description: 'Análisis de ventas y pedidos desde una fuente autorizada.', triggers: ['ventas', 'ingresos', 'pedidos'], requiresConnector: true },
  { name: 'customers', title: 'Agente de Clientes', description: 'Consulta de clientes desde el sistema conectado.', triggers: ['clientes', 'clientas'], requiresConnector: true },
  { name: 'appointments', title: 'Agente de Citas', description: 'Consulta y gestión de reservas/citas.', triggers: ['cita', 'citas', 'agenda', 'reservas'], requiresConnector: true },
  { name: 'documents', title: 'Agente Documental', description: 'Búsqueda, resumen y comparación de documentos autorizados.', triggers: ['documento', 'contrato', 'pdf', 'factura'], requiresConnector: true },
  { name: 'automation', title: 'Agente de Automatización', description: 'Diseña y supervisa flujos de automatización.', triggers: ['automatiza', 'automatización', 'flujo'], requiresConnector: true },
  { name: 'system', title: 'Agente de Sistema', description: 'Diagnóstico de salud, errores e integraciones.', triggers: ['error', 'fallo', 'sistema', 'salud', 'latencia'], requiresConnector: true },
  { name: 'connector', title: 'Agente Connector', description: 'Descubre y prepara integraciones por solicitud explícita del propietario.', triggers: ['conectar', 'integrar', 'api', 'connector'], requiresConnector: false },
  { name: 'security', title: 'Agente de Seguridad', description: 'Evalúa permisos, políticas y aprobaciones antes de acciones sensibles.', triggers: ['permiso', 'seguridad', 'autoriza', 'aprobación'], requiresConnector: false },
] as const;

export function getAgent(name: AgentName): AgentDescriptor { return AGENTS.find((agent) => agent.name === name)!; }
