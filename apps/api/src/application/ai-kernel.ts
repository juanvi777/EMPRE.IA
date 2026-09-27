import { EMPRE_DIFFERENTIATORS, EMPRE_IDENTITY, EMPRE_PRINCIPLES, EMPRE_SYSTEM_INSTRUCTIONS } from '../domain/empre-core.js';
import { canUseAi, getTenantPlan, getUsageSnapshot, recordUsage } from './billing.js';
import { executeConnectorTool, getConnectorTools, getPrimaryConnector, hasOperationalConnection } from './connectors.js';
import { appendAssistantMessage, getAssistantHistory } from './assistant-history.js';
import { generateWithRealAi, isRealAiConfigured } from './ai-provider.js';
import { db, row } from '../infrastructure/db/database.js';

export type AssistantIntent =
  | 'greeting' | 'thanks' | 'capabilities' | 'summary' | 'clients' | 'appointments' | 'portfolio'
  | 'tasks' | 'agents' | 'automations' | 'sales' | 'analysis' | 'report' | 'connections'
  | 'plan' | 'difference' | 'safety' | 'unknown';

export interface AiKernelResult {
  readonly reply: string;
  readonly intent: AssistantIntent;
  readonly mode: 'local-core' | 'connector' | 'llm';
  readonly usageUnits: number;
  readonly suggestedActions: readonly string[];
  readonly dataSource: 'empre-local' | 'external-connector' | 'none';
  readonly provider: 'openai' | 'local-kernel';
  readonly model: string | null;
  readonly citations?: readonly { title: string; url: string }[];
  readonly webSearched?: boolean;
}

function intentFor(message: string): AssistantIntent {
  const text = message.toLocaleLowerCase('es-CO').trim();
  if (/^(hola|holaa|hey|buenas|buen d[ií]a|buenas tardes|buenas noches|qu[eé] tal|como est[aá]s|c[oó]mo est[aá]s)\b/.test(text) || /\b(c[oó]mo est[aá]s|c[oó]mo te va)\b/.test(text)) return 'greeting';
  if (/\b(gracias|muchas gracias|te agradezco|perfecto gracias)\b/.test(text)) return 'thanks';
  if (/(cita|citas|agenda|agendamiento|reservas?)/.test(text)) return 'appointments';
  if (/(portafolio|portfolio|fotos?|dise[nñ]os?)/.test(text)) return 'portfolio';
  if (/(ventas?|ingresos?|facturaci[oó]n|facturas?|vendi[oó]|vend[ai]mos)/.test(text)) return 'sales';
  if (/(analiza|analisis|an[aá]lisis|indicadores|m[eé]tricas|rendimiento|desempe[nñ]o|anomal[ií]as)/.test(text)) return 'analysis';
  if (/(informe|reporte|reportar|resumen mensual|resumen semanal)/.test(text)) return 'report';
  if (/(conectad|conexi[oó]n|integraci[oó]n|integraciones|fuente de datos|api)/.test(text)) return 'connections';
  if (/(diferenc|especial|importante|por qu[eé] usar|ventaja)/.test(text)) return 'difference';
  if (/(plan|precio|versi[oó]n|gratis|go|pro|business|suscripci[oó]n|pagar)/.test(text)) return 'plan';
  if (/(segur|permiso|autoriz|aprobaci[oó]n|riesgo)/.test(text)) return 'safety';
  if (/(qu[eé] puedes|capacidades|funciones|sirves|para qu[eé])/.test(text)) return 'capabilities';
  if (/(resumen|estado|dashboard|panel|situaci[oó]n)/.test(text)) return 'summary';
  if (/cliente|clientes/.test(text)) return 'clients';
  if (/tarea|pendiente|pendientes/.test(text)) return 'tasks';
  if (/agente|agentes/.test(text)) return 'agents';
  if (/automatiz/.test(text)) return 'automations';
  return 'unknown';
}

function requiresBusinessConnector(message: string, intent: AssistantIntent): boolean {
  if (['clients','appointments','portfolio','sales','tasks','agents','automations'].includes(intent)) return true;
  if (intent === 'summary' || intent === 'report') return true;
  if (intent !== 'analysis') return false;
  const text = message.toLocaleLowerCase('es-CO');
  return /\b(mis|mi|nuestro|nuestra|ventas|ingresos|clientes|citas|facturas|inventario|operación|empresa|negocio|datos internos|dashboard)\b/.test(text);
}

function tenantName(tenantId: string): string { return String(row<{ name: string }>(db.prepare('SELECT name FROM tenants WHERE id=?'), tenantId)?.name ?? 'tu empresa'); }

function connectionRequired(company: string, connectorName = ''): AiKernelResult {
  return {
    reply: `La operación está bloqueada porque ${EMPRE_IDENTITY.name} todavía no tiene conectado el sistema de ${company}.${connectorName ? ` El conector ${connectorName} existe pero no está operativo.` : ''} Para continuar: 1) abre Integraciones; 2) elige el tipo de sistema; 3) introduce la URL base de su API; 4) crea o usa una cuenta de integración con los permisos necesarios; 5) configura la autenticación; 6) pulsa “Conectar y verificar”; 7) prueba una lectura. Hasta que esa verificación sea correcta, no leeré ni modificaré datos externos.`,
    intent: 'connections', mode: 'local-core', usageUnits: 1, suggestedActions: ['Abrir Integraciones', 'Cómo conectar mi sistema'], dataSource: 'none', provider: 'local-kernel', model: null,
  };
}

function parseListPayload(payload: unknown, key: string): unknown[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

function sanitizeClientContext(payload: unknown): unknown {
  return parseListPayload(payload, 'users').slice(0, 30).map((item) => typeof item === 'object' && item !== null ? {
    id: String((item as Record<string, unknown>).id ?? ''), name: String((item as Record<string, unknown>).name ?? ''), role: String((item as Record<string, unknown>).role ?? ''), status: String((item as Record<string, unknown>).status ?? ''),
  } : item);
}

function sanitizeAppointmentContext(payload: unknown): unknown {
  return parseListPayload(payload, 'appointments').slice(0, 40).map((item) => typeof item === 'object' && item !== null ? {
    id: String((item as Record<string, unknown>).id ?? ''), client_name: String((item as Record<string, unknown>).client_name ?? ''), service: String((item as Record<string, unknown>).service ?? ''), appointment_date: String((item as Record<string, unknown>).appointment_date ?? ''), appointment_time: String((item as Record<string, unknown>).appointment_time ?? ''), status: String((item as Record<string, unknown>).status ?? ''),
  } : item);
}

async function buildExternalContext(tenantId: string, intent: AssistantIntent): Promise<{ text: string; dataSource: AiKernelResult['dataSource']; mode: AiKernelResult['mode'] }> {
  if (!hasOperationalConnection(tenantId)) return { text: '', dataSource: 'none', mode: 'local-core' };
  const connector = getPrimaryConnector(tenantId);
  if (!connector) return { text: '', dataSource: 'none', mode: 'local-core' };
  const tools = getConnectorTools(tenantId);
  const preferredByIntent: Partial<Record<AssistantIntent, string[]>> = {
    clients: ['clients.list'],
    appointments: ['appointments.list'],
    portfolio: ['portfolio.list'],
    sales: ['sales.summary','sales.list','orders.summary','orders.list'],
  };
  const available = (preferredByIntent[intent] ?? []).find((name) => tools.some((tool) => tool.name === name));
  if (available) {
    const payload = await executeConnectorTool(tenantId, available);
    return { text: JSON.stringify({ source: connector.name, tool: available, result: payload }), dataSource: 'external-connector', mode: 'connector' };
  }
  if (['summary','analysis','report'].includes(intent)) {
    const readable = tools.filter((tool) => tool.readOnly).slice(0, 12).map((tool) => ({ name: tool.name, description: tool.description ?? '' }));
    return { text: JSON.stringify({ source: connector.name, availableReadTools: readable }), dataSource: 'external-connector', mode: 'connector' };
  }
  return { text: `Sistema conectado: ${connector.name}. Herramientas declaradas: ${tools.map((tool) => tool.name).join(', ') || 'ninguna'}.`, dataSource: 'external-connector', mode: 'connector' };
}

function localReply(tenantId: string, intent: AssistantIntent, connected: boolean, company: string, plan: ReturnType<typeof getTenantPlan>, usage: ReturnType<typeof getUsageSnapshot>, externalText: string) {
  let external: { source?: string; clients?: unknown[]; appointments?: unknown[]; portfolio?: unknown[] } = {};
  if (externalText) {
    try { external = JSON.parse(externalText) as typeof external; }
    catch { /* contexto no estructurado */ }
  }
  const clientCount = Array.isArray(external.clients) ? external.clients.length : 0;
  const appointmentCount = Array.isArray(external.appointments) ? external.appointments.length : 0;
  const portfolioCount = Array.isArray(external.portfolio) ? external.portfolio.length : 0;

  switch (intent) {
    case 'greeting': return { reply: connected ? `¡Hola! Soy ${EMPRE_IDENTITY.name}. ${company} tiene un sistema conectado. Antes de responder una petición de negocio, comprobaré la fuente y los permisos disponibles.` : `¡Hola! Soy ${EMPRE_IDENTITY.name}. El núcleo de ${company} está operativo, pero todavía no hay un sistema externo conectado.` , suggestedActions: connected ? ['Muéstrame mis clientes', 'Muéstrame mis citas', 'Analiza la operación'] : ['Abrir Integraciones', '¿Qué puedes hacer?', 'Ver planes'] };
    case 'thanks': return { reply: '¡Con gusto! Una respuesta de EMPRE sólo se presenta como dato real cuando la fuente correspondiente pudo ser consultada o verificada.', suggestedActions: connected ? ['Muéstrame mis clientes', 'Muéstrame mis citas'] : ['Abrir Integraciones'] };
    case 'capabilities': return { reply: `Soy ${EMPRE_IDENTITY.name}. Mi objetivo es convertir una solicitud empresarial en contexto, plan, herramienta autorizada, ejecución verificable y evidencia. ${connected ? 'Ya tienes un sistema conectado.' : 'Aún no tienes un sistema externo conectado.'}`, suggestedActions: connected ? ['Muéstrame mis clientes', 'Muéstrame mis citas', 'Analiza la operación'] : ['Cómo conectar mi sistema', 'Abrir Integraciones'] };
    case 'connections': { const connector = getPrimaryConnector(tenantId); const tools = getConnectorTools(tenantId); return { reply: connector ? `Sí. ${connector.name} está conectado y operativo. Tiene ${tools.length} herramientas declaradas para EMPRE.` : `No hay un Connector operativo para ${company}. Abre Integraciones y completa la prueba de conexión.`, suggestedActions: connector ? ['Probar conexión', 'Ver herramientas'] : ['Cómo conectar mi sistema', 'Abrir Integraciones'] }; }
    case 'plan': return { reply: `Tu plan actual es ${plan.name}. Uso de IA este mes: ${usage.used.toLocaleString('es-CO')}/${usage.limit.toLocaleString('es-CO')} unidades.`, suggestedActions: ['Comparar planes', 'Ver consumo'] };
    case 'summary': return { reply: connected ? `Resumen del sistema conectado: ${clientCount} clientes, ${appointmentCount} citas y ${portfolioCount} elementos de portafolio disponibles en la lectura actual. No estoy inventando cifras de ventas porque el Connector todavía no expone ventas.` : `El núcleo de ${company} está operativo, pero no hay una fuente externa conectada. No puedo presentar un resumen de negocio como si tuviera acceso a tus datos.`, suggestedActions: connected ? ['Muéstrame mis clientes', 'Muéstrame mis citas', 'Revisar Integraciones'] : ['Abrir Integraciones'] };
    case 'clients': return { reply: connected ? (externalText.includes('clients.list') ? `Consulté la herramienta clients.list del sistema ${getPrimaryConnector(tenantId)?.name ?? 'conectado'}.` : `El sistema está conectado, pero no declara una herramienta clients.list. No puedo inventar datos de clientes.`) : `No puedo consultar clientes sin un Connector operativo para ${company}.`, suggestedActions: connected ? ['Ver herramientas', 'Probar conexión'] : ['Abrir Integraciones'] };
    case 'appointments': return { reply: connected ? (externalText.includes('appointments.list') ? `Consulté la herramienta appointments.list del sistema ${getPrimaryConnector(tenantId)?.name ?? 'conectado'}.` : `El sistema está conectado, pero no declara una herramienta appointments.list.`) : `No puedo consultar citas sin un Connector operativo para ${company}.`, suggestedActions: connected ? ['Ver herramientas', 'Probar conexión'] : ['Abrir Integraciones'] };
    case 'portfolio': return { reply: connected ? (externalText.includes('portfolio.list') ? `Consulté la herramienta portfolio.list del sistema conectado.` : `El sistema está conectado, pero no declara una herramienta portfolio.list.`) : `No puedo consultar el portafolio sin un Connector operativo para ${company}.`, suggestedActions: connected ? ['Ver herramientas', 'Probar conexión'] : ['Abrir Integraciones'] };
    case 'analysis': return { reply: connected ? `Puedo analizar únicamente las herramientas que el sistema conectado declara y que responden correctamente. No inferiré información que el sistema no exponga.` : `No ejecutaré un análisis de negocio sin una fuente externa conectada a ${company}. Primero debemos verificar el Connector.`, suggestedActions: connected ? ['Ver herramientas', 'Probar conexión'] : ['Abrir Integraciones'] };
    case 'report': return { reply: connected ? `Puedo preparar un informe con las herramientas de lectura declaradas por ${getPrimaryConnector(tenantId)?.name ?? 'el sistema conectado'}. Herramientas disponibles: ${getConnectorTools(tenantId).map((tool) => tool.name).join(', ') || 'ninguna'}.` : `No puedo preparar un informe de negocio fiable sin una fuente externa conectada a ${company}.`, suggestedActions: connected ? ['Ver herramientas', 'Probar conexión'] : ['Abrir Integraciones'] };
    case 'difference': return { reply: 'EMPRE busca unir IA, contexto empresarial, herramientas, Connectors, políticas, aprobaciones, memoria y auditoría. Una conversación no equivale a una ejecución.', suggestedActions: ['Ver arquitectura', 'Ver seguridad'] };
    case 'safety': return { reply: `Una salida de IA no es una autorización. ${EMPRE_PRINCIPLES[1]} ${EMPRE_PRINCIPLES[4]} ${EMPRE_PRINCIPLES[7]}`, suggestedActions: ['Ver permisos', 'Ver auditoría'] };
    case 'sales': return { reply: connected ? ((externalText.includes('sales.summary') || externalText.includes('sales.list') || externalText.includes('orders.summary') || externalText.includes('orders.list')) ? 'El sistema conectado declara una herramienta de ventas o pedidos. Puedo consultarla únicamente cuando responda correctamente.' : 'El sistema está conectado, pero no declara una herramienta de ventas o pedidos. No voy a inventar cifras.') : `No puedo analizar ventas porque no existe una fuente externa conectada a ${company}.`, suggestedActions: connected ? ['Ver herramientas', 'Probar conexión'] : ['Abrir Integraciones'] };
    case 'unknown': return { reply: `Puedo ayudarte con la operación disponible y decirte cuando falte una conexión, permiso o herramienta. Puedes preguntarme algo concreto sobre clientes, citas, el estado del sistema, tus planes o cómo conectar una plataforma.`, suggestedActions: connected ? ['Muéstrame mis clientes', 'Muéstrame mis citas', 'Analiza la operación'] : ['Abrir Integraciones', '¿Qué puedes hacer?'] };
    default: return { reply: `La solicitud está dentro del alcance del núcleo. ${connected ? 'La fuente externa conectada será la referencia para los datos de negocio.' : 'No hay una fuente externa conectada todavía.'}`, suggestedActions: connected ? ['Muéstrame mis clientes', 'Muéstrame mis citas'] : ['Abrir Integraciones'] };
  }
}

export async function answerWithKernel(tenantId: string, userId: string, message: string): Promise<AiKernelResult> {
  const clean = message.trim();
  const intent = intentFor(clean);
  const usageUnits = Math.max(1, Math.ceil(clean.length / 180));
  if (!canUseAi(tenantId, usageUnits)) {
    const usage = getUsageSnapshot(tenantId);
    const result: AiKernelResult = { reply: `Has alcanzado el límite mensual de uso de IA de tu plan. Llevas ${usage.used.toLocaleString('es-CO')} de ${usage.limit.toLocaleString('es-CO')} unidades.`, intent: 'plan', mode: 'local-core', usageUnits: 0, suggestedActions: ['Revisar planes', 'Revisar consumo'], dataSource: 'none', provider: 'local-kernel', model: null };
    appendAssistantMessage(tenantId, userId, 'user', clean); appendAssistantMessage(tenantId, userId, 'assistant', result.reply); return result;
  }

  appendAssistantMessage(tenantId, userId, 'user', clean);
  const connected = hasOperationalConnection(tenantId);
  const plan = getTenantPlan(tenantId);
  const usage = getUsageSnapshot(tenantId);
  const company = tenantName(tenantId);

  if (!connected && requiresBusinessConnector(clean, intent)) {
    const result = { ...connectionRequired(company), usageUnits };
    appendAssistantMessage(tenantId, userId, 'assistant', result.reply); recordUsage(tenantId, 'assistant.connection-gate', usageUnits, { intent }); return result;
  }

  let external = { text: '', dataSource: 'none' as AiKernelResult['dataSource'], mode: 'local-core' as AiKernelResult['mode'] };
  try { external = await buildExternalContext(tenantId, intent); } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo consultar el sistema externo.';
    const result: AiKernelResult = { reply: `No voy a inventar la respuesta. El Connector está configurado, pero la consulta falló: ${message}`, intent: 'connections', mode: 'connector', usageUnits, suggestedActions: ['Probar lectura', 'Revisar Integraciones'], dataSource: 'none', provider: 'local-kernel', model: null };
    appendAssistantMessage(tenantId, userId, 'assistant', result.reply); recordUsage(tenantId, 'assistant.external-error', usageUnits, { intent }); return result;
  }

  const history = getAssistantHistory(tenantId, userId, 12).filter((item) => item.text !== clean || item.role !== 'user').map((item) => ({ role: item.role, text: item.text }));
  const mustStayDeterministic = intent === 'sales' || intent === 'connections' || intent === 'safety';
  const llm = mustStayDeterministic ? null : await generateWithRealAi({ message: clean, history, context: external.text, company, plan: plan.aiLevel });
  if (llm) {
    const result: AiKernelResult = { reply: llm.text, intent, mode: 'llm', usageUnits, suggestedActions: external.dataSource === 'external-connector' ? ['Muéstrame mis clientes', 'Muéstrame mis citas', 'Analiza la operación'] : ['Investiga en Internet', '¿Qué tienes conectado?', 'Cómo conectar mi sistema'], dataSource: external.dataSource, provider: 'openai', model: llm.model, citations: llm.citations, webSearched: llm.webSearched };
    appendAssistantMessage(tenantId, userId, 'assistant', result.reply); recordUsage(tenantId, 'assistant', usageUnits, { intent, dataSource: result.dataSource, mode: result.mode, provider: 'openai' }); return result;
  }

  const local = localReply(tenantId, intent, connected, company, plan, usage, external.text);
  const result: AiKernelResult = { reply: local.reply, intent, mode: external.mode, usageUnits, suggestedActions: local.suggestedActions, dataSource: external.dataSource, provider: 'local-kernel', model: null };
  appendAssistantMessage(tenantId, userId, 'assistant', result.reply); recordUsage(tenantId, 'assistant', usageUnits, { intent, dataSource: result.dataSource, mode: result.mode, provider: 'local-kernel', realAiConfigured: isRealAiConfigured() });
  return result;
}

export function getCoreBrief() { return { identity: EMPRE_IDENTITY, principles: EMPRE_PRINCIPLES, differentiators: EMPRE_DIFFERENTIATORS, systemInstructions: EMPRE_SYSTEM_INSTRUCTIONS }; }
