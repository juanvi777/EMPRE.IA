export type PlanId = 'free' | 'go' | 'pro' | 'business';
export type AiLevel = 'basic' | 'advanced';

export interface PlanDefinition {
  readonly id: PlanId;
  readonly name: string;
  readonly monthlyCop: number;
  readonly annualCop: number;
  readonly monthlyCredits: number;
  readonly aiLevel: AiLevel;
  readonly integrationsLimit: number | null;
  readonly summary: string;
  readonly highlights: readonly string[];
}

/**
 * EMPRE.IA's product catalog for the local/core milestone.
 * Prices are a proposed commercial starting point, not a live billing contract.
 */
export const PLAN_DEFINITIONS: readonly PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyCop: 0,
    annualCop: 0,
    monthlyCredits: 300,
    aiLevel: 'basic',
    integrationsLimit: 1,
    summary: 'Conoce EMPRE.IA y prueba el núcleo empresarial con una integración de prueba.',
    highlights: ['Chat básico', 'Panel empresarial', '1 integración de prueba', 'Sin automatización productiva'],
  },
  {
    id: 'go',
    name: 'Go',
    monthlyCop: 59_900,
    annualCop: 599_000,
    monthlyCredits: 2_500,
    aiLevel: 'basic',
    integrationsLimit: 2,
    summary: 'IA práctica para pequeñas empresas y operaciones diarias.',
    highlights: ['IA básica', 'Automatizaciones simples', 'Hasta 2 integraciones', 'Memoria empresarial básica'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyCop: 199_900,
    annualCop: 1_999_000,
    monthlyCredits: 15_000,
    aiLevel: 'advanced',
    integrationsLimit: 10,
    summary: 'Agentes, análisis y automatización avanzada para operar el negocio.',
    highlights: ['IA avanzada', 'Agentes supervisados', 'Hasta 10 integraciones', 'Análisis y automatizaciones avanzadas'],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyCop: 599_900,
    annualCop: 5_999_000,
    monthlyCredits: 50_000,
    aiLevel: 'advanced',
    integrationsLimit: null,
    summary: 'Capacidad empresarial, control, auditoría y operación a escala.',
    highlights: ['IA avanzada', 'Gobierno y auditoría', 'Integraciones avanzadas', 'Prioridad y políticas empresariales'],
  },
];

export const EMPRE_IDENTITY = {
  name: 'EMPRE.IA',
  tagline: 'Tu empresa, más inteligente.',
  purpose: 'Convertir IA en capacidad operativa empresarial: entender, analizar, planificar y ejecutar dentro de límites autorizados.',
  localStatus: 'Núcleo local en construcción; no representa todavía un modelo LLM real ni conexiones externas de producción.',
} as const;

export const EMPRE_PRINCIPLES = [
  'No inventar: diferenciar lo que sabe, lo que puede consultar y lo que todavía no está conectado.',
  'Denegar por defecto: una respuesta de IA nunca equivale por sí sola a una autorización.',
  'Tenant primero: cada dato, herramienta, ejecución y auditoría debe pertenecer a una empresa concreta.',
  'Leer antes de escribir: priorizar observación, contexto y vista previa antes de acciones con efecto.',
  'Aprobación para riesgo: acciones externas, sensibles o irreversibles requieren políticas y aprobación humana cuando corresponda.',
  'Trazabilidad: toda acción relevante debe poder explicarse mediante actor, herramienta, política, alcance y resultado.',
  'Privilegios mínimos: cada agente y conector recibe únicamente las capacidades que necesita.',
  'Fallar de forma segura: ante duda, datos incompletos o conexión perdida, EMPRE debe detener la acción y explicar el estado.',
] as const;

export const EMPRE_DIFFERENTIATORS = [
  {
    title: 'IA que opera, no sólo conversa',
    description: 'El objetivo es llevar una conversación hasta una tarea empresarial verificable mediante herramientas y conectores autorizados.',
  },
  {
    title: 'Una capa para cualquier sistema',
    description: 'EMPRE se diseña alrededor de connectors y contratos de herramientas, para poder conectar sistemas distintos sin rehacer el núcleo.',
  },
  {
    title: 'Control humano y seguridad',
    description: 'Las capacidades se limitan por empresa, usuario, rol, herramienta y política; las acciones sensibles pueden pasar por aprobación.',
  },
  {
    title: 'Memoria y contexto empresarial',
    description: 'La IA debe trabajar con el contexto autorizado de la empresa, no responder como si cada conversación estuviera aislada.',
  },
  {
    title: 'Auditoría de extremo a extremo',
    description: 'Las ejecuciones importantes deben dejar evidencia suficiente para saber qué se pidió, qué se intentó y qué resultado ocurrió.',
  },
  {
    title: 'Motor independiente del proveedor de IA',
    description: 'La plataforma separa el núcleo empresarial del proveedor/modelo concreto para poder evolucionar la capa de IA sin reconstruir el producto.',
  },
] as const;

export const EMPRE_POLICY_DEFAULTS = [
  { key: 'data.read', effect: 'allow', requiresApproval: false },
  { key: 'analysis.run', effect: 'allow', requiresApproval: false },
  { key: 'record.create', effect: 'approval', requiresApproval: true },
  { key: 'record.update', effect: 'approval', requiresApproval: true },
  { key: 'communication.send', effect: 'approval', requiresApproval: true },
  { key: 'payment.execute', effect: 'approval', requiresApproval: true },
  { key: 'data.delete', effect: 'deny', requiresApproval: true },
  { key: 'system.change', effect: 'approval', requiresApproval: true },
] as const;

export const EMPRE_SYSTEM_INSTRUCTIONS = [
  'Identidad: eres EMPRE.IA, una capa de inteligencia y operación empresarial.',
  'Objetivo: ayudar a la empresa a comprender información, decidir con contexto y ejecutar acciones autorizadas.',
  'Nunca afirmes haber consultado, cambiado, enviado o ejecutado algo que el sistema no haya confirmado.',
  'Antes de una acción con efecto externo, comprueba herramienta, tenant, permiso, política y necesidad de aprobación.',
  'Cuando no haya conector o herramienta disponible, dilo de forma explícita y ofrece el siguiente paso seguro.',
  'Prioriza respuestas concretas: contexto -> hallazgo -> propuesta -> acción autorizada -> evidencia.',
  'Protege secretos, datos de otras empresas y cualquier información fuera del alcance de la solicitud.',
  'Si una instrucción entra en conflicto con políticas o permisos, no la ejecutes; explica el bloqueo.',
] as const;

export function getPlanDefinition(planId: string): PlanDefinition {
  return PLAN_DEFINITIONS.find((plan) => plan.id === planId) ?? PLAN_DEFINITIONS[0];
}
