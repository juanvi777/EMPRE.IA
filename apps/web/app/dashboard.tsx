'use client';

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import IntegrationGuide from './integration-guide';

export type ApiState =
  | { available: true; health: { environment: string; service: string; version: string } }
  | { available: false; reason: string };

type PlanId = 'free' | 'go' | 'pro' | 'business';
type BillingCycle = 'monthly' | 'annual';

type DashboardSummary = {
  tenantName: string;
  plan: { id: PlanId; name: string; aiLevel: 'basic' | 'advanced'; monthlyCredits: number; integrationsLimit: number | null };
  usage: { month: string; used: number; limit: number; remaining: number; percent: number };
  clients: number;
  tasks: number;
  agents: number;
  automations: number;
  integrations: Array<{ id: string; name: string; kind: string; status: string }>;
  clientsList: Array<{ id: string; name: string; email: string; status: string }>;
  recentTasks: Array<{ id: string; title: string; detail: string; status: string }>;
  agentsList: Array<{ id: string; name: string; description: string; status: string }>;
  automationsList: Array<{ id: string; name: string; description: string; status: string }>;
  connection: { connected: boolean; primary: ConnectorSummary | null; connectors: ConnectorSummary[] };
};

type CurrentUser = { id: string; tenantId: string; tenantName: string; name: string; email: string; role: 'owner' | 'admin' | 'operator' | 'viewer' };

type CompanyProfile = {
  name: string;
  slug: string;
  countryCode: string;
  businessType: 'legal_entity' | 'natural_person' | 'informal';
  legalRegistered: boolean;
  legalName: string | null;
  nit: string | null;
  nitDv: string | null;
  nitVerificationStatus: 'not_required' | 'pending' | 'invalid_format' | 'locally_validated' | 'officially_verified' | 'manual_review';
  taxDeclaration: 'obligated' | 'not_obligated' | 'unknown';
  taxResponsibilities: string[];
  legalSetupCompleted: boolean;
};

type BillingStatus = {
  provider: 'mercado-pago';
  configured: boolean;
  environment: 'sandbox' | 'production' | 'unconfigured';
  hasPaymentLink: boolean;
  method: 'checkout-pro-orders' | 'payment-link' | 'unconfigured';
  message: string;
};

type ExternalClient = { id: string; name: string; email: string; status: string; role?: string };
type ExternalAppointment = { id: string; client_name: string; service: string; appointment_date: string; appointment_time: string; status: string };
type ExternalSlot = string;
type PendingApproval = { id: string; tool: string; input: Record<string, unknown>; status: string; createdAt: string };
type ChatCitation = { title: string; url: string };
type ChatMessage = { role: 'ai' | 'user'; text: string; citations?: ChatCitation[]; webSearched?: boolean; agent?: string };
type AiStatus = { configured: boolean; provider: 'openai' | 'local-kernel'; webSearchEnabled: boolean; webSearchMode: 'live' | 'disabled' };


type ConnectorSummary = {
  id: string;
  name: string;
  preset: string;
  baseUrl: string;
  authMode: 'none' | 'login' | 'bearer' | 'api_key';
  healthPath: string;
  verificationPath: string;
  loginPath: string;
  manifestPath: string;
  status: 'draft' | 'testing' | 'connected' | 'error' | 'disabled';
  lastCheckedAt: string | null;
  lastError: string | null;
  tools: Array<{ name: string; method: string; path: string; readOnly: boolean; description?: string }>;
};

type ApiAuditEvent = { id: string; action: string; resource_type: string; result: string; created_at: string };

const commercialPlans = [
  { id: 'free' as const, name: 'Free', monthly: 0, annual: 0, audience: 'Prueba el núcleo', level: 'IA básica', credits: '300 unidades/mes', highlights: ['Chat básico', 'Panel empresarial', '1 integración de prueba', 'Sin automatización productiva'] },
  { id: 'go' as const, name: 'Go', monthly: 59_900, annual: 599_000, audience: 'Pequeñas operaciones', level: 'IA básica + automatización', credits: '2.500 unidades/mes', highlights: ['Automatizaciones simples', 'Hasta 2 integraciones', 'Memoria empresarial básica', 'Controles esenciales'] },
  { id: 'pro' as const, name: 'Pro', monthly: 199_900, annual: 1_999_000, audience: 'Operación avanzada', level: 'IA avanzada + agentes', credits: '15.000 unidades/mes', highlights: ['Agentes supervisados', 'Hasta 10 integraciones', 'Análisis avanzado', 'Memoria y políticas ampliadas'] },
  { id: 'business' as const, name: 'Business', monthly: 599_900, annual: 5_999_000, audience: 'Empresas con escala', level: 'IA avanzada + gobierno', credits: '50.000 unidades/mes', highlights: ['Gobierno y auditoría', 'Integraciones avanzadas', 'Políticas empresariales', 'Prioridad y operación a escala'] },
];

const differentiators = [
  ['IA que opera, no sólo conversa', 'El objetivo es convertir una petición en un plan y, con herramientas autorizadas, en una ejecución verificable.'],
  ['Una capa para cualquier sistema', 'El Connector Hub desacopla EMPRE del software concreto de cada empresa.'],
  ['Contexto empresarial', 'La memoria futura pertenece al tenant y se mantiene dentro del alcance autorizado.'],
  ['Seguridad por diseño', 'Permisos, políticas, aprobaciones y privilegio mínimo acompañan cada acción sensible.'],
  ['Auditoría de extremo a extremo', 'Las operaciones importantes dejan evidencia del actor, alcance, herramienta, política y resultado.'],
  ['Motor IA intercambiable', 'La plataforma separa el núcleo empresarial del proveedor o modelo concreto.'],
] as const;

type IconName =
  | 'home' | 'chat' | 'analysis' | 'automation' | 'users' | 'docs' | 'integrations' | 'agents' | 'tasks' | 'settings' | 'search'
  | 'bell' | 'help' | 'sun' | 'moon' | 'send' | 'spark' | 'arrow' | 'more' | 'check' | 'zap' | 'mail' | 'database'
  | 'github' | 'whatsapp' | 'file' | 'chart' | 'robot' | 'calendar' | 'close' | 'refresh' | 'shield';

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4.5-1.3L4 19l1.4-3.1A7.3 7.3 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.7 7.7 0 0 1 8 7.5Z" /><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" /></>,
    analysis: <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></>,
    automation: <path d="m13 2-9 12h7l-1 8 9-12h-7Z" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    docs: <><path d="M6 2h9l3 3v17H6z" /><path d="M14 2v4h4M9 12h6M9 16h6" /></>,
    integrations: <><path d="M8 12h8" /><path d="M12 8v8" /><path d="M5 7a3 3 0 1 0 0 6M19 11a3 3 0 1 0 0 6" /></>,
    agents: <><rect x="5" y="5" width="14" height="14" rx="4" /><path d="M9 10h.01M15 10h.01M9 14c1.8 1.3 4.2 1.3 6 0" /><path d="M12 2v3M2 12h3M19 12h3" /></>,
    tasks: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 2.5 2.5L16 9" /></>,
    settings: <><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" /><circle cx="12" cy="12" r="4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 1.8-2.5 2-2.5 3.5M12 17h.01" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />,
    send: <><path d="m4 4 16 8-16 8 3-8Z" /><path d="m7 12 13 0" /></>,
    spark: <><path d="m12 3-1.3 5.7L5 10l5.7 1.3L12 17l1.3-5.7L19 10l-5.7-1.3Z" /><path d="m19 17-.5 2.1L16.5 20l2-.9.5-2.1.5 2.1 2 .9-2-.9Z" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    zap: <path d="m13 2-9 12h7l-1 8 9-12h-7Z" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></>,
    github: <path d="M15 22v-4.5c0-1.2-.4-2.1-1.2-2.8 3.8-.4 7.8-1.9 7.8-8.5a6.7 6.7 0 0 0-1.8-4.6A6.2 6.2 0 0 0 19.6 0S18.1-.5 15 1.6a9.7 9.7 0 0 0-6 0C5.9-.5 4.4 0 4.4 0A6.2 6.2 0 0 0 4.2 1.6 6.7 6.7 0 0 0 2.4 6.2c0 6.6 4 8.1 7.8 8.5-.8.7-1.2 1.8-1.2 3.4V22" />,
    whatsapp: <><path d="M20 11.5a7.5 7.5 0 0 1-12.6 5.4L4 19l1.6-3.4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M9 9c.2 1.6 2.1 3.9 4.1 4.8" /></>,
    file: <><path d="M7 3h7l3 3v15H7z" /><path d="M14 3v4h4" /></>,
    chart: <><path d="M4 19V9M9 19V5M14 19v-8M19 19V3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    robot: <><rect x="5" y="7" width="14" height="12" rx="4" /><path d="M12 4v3M8 11h.01M16 11h.01M9 15c1.7 1.1 4.3 1.1 6 0" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const navItems: { label: string; icon: IconName }[] = [
  { label: 'Inicio', icon: 'home' },
  { label: 'Chat con IA', icon: 'chat' },
  { label: 'Análisis', icon: 'analysis' },
  { label: 'Automatizaciones', icon: 'automation' },
  { label: 'Clientes', icon: 'users' },
  { label: 'Documentos', icon: 'docs' },
  { label: 'Integraciones', icon: 'integrations' },
  { label: 'Agentes', icon: 'agents' },
  { label: 'Tareas', icon: 'tasks' },
  { label: 'Mi empresa', icon: 'settings' },
  { label: 'Planes y facturación', icon: 'chart' },
  { label: 'Configuración', icon: 'settings' },
];

const initialChat: ChatMessage[] = [{ role: 'ai', text: 'Hola, soy EMPRE.IA. Estoy lista para trabajar contigo. Puedo conversar, investigar en Internet cuando la IA real esté configurada y trabajar con los datos de tu empresa cuando exista un Connector verificado.' }];

function money(value: number) {
  return value === 0 ? '$0' : `$${value.toLocaleString('es-CO')}`;
}

function statusLabel(status: CompanyProfile['nitVerificationStatus']) {
  return {
    not_required: 'No requerido', pending: 'Pendiente de verificación oficial', invalid_format: 'Formato inválido', locally_validated: 'Validado localmente', officially_verified: 'Verificado oficialmente', manual_review: 'Revisión manual',
  }[status];
}

function ModuleView(props: {
  active: string;
  chat: ChatMessage[];
  setChat: Dispatch<SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: (value: string) => void;
  sendMessage: (message?: string) => void;
  taskDone: Record<string, boolean>;
  setTaskDone: Dispatch<SetStateAction<Record<string, boolean>>>;
  agentsState: Record<string, boolean>;
  setAgentsState: Dispatch<SetStateAction<Record<string, boolean>>>;
  integrationState: Record<string, boolean>;
  setIntegrationState: Dispatch<SetStateAction<Record<string, boolean>>>;
  chatPending: boolean;
  summary: DashboardSummary | null;
  company: CompanyProfile | null;
  billing: BillingStatus | null;
  planName: string;
  usageText: string;
  onPlanChange: (planId: PlanId) => void;
  onCheckout: (planId: Exclude<PlanId, 'free'>, cycle: BillingCycle) => Promise<void>;
  refreshCompany: () => Promise<void>;
  billingReturnMessage: string;
  apiBaseUrl: string;
  token: string | null;
  openModule: (label: string) => void;
  chatSuggestedActions: string[];
  setChatSuggestedActions: Dispatch<SetStateAction<string[]>>;
  aiStatus: AiStatus;
  clearChat: () => void;
  connection: DashboardSummary['connection'];
  refreshConnection: () => Promise<void>;
}) {
  const { active, chat, setChat, input, setInput, sendMessage, taskDone, setTaskDone, agentsState, setAgentsState, integrationState, setIntegrationState, chatPending, summary, company, billing, planName, usageText, onPlanChange, onCheckout, refreshCompany, billingReturnMessage, apiBaseUrl, token, openModule, chatSuggestedActions, setChatSuggestedActions, clearChat, connection, refreshConnection, aiStatus } = props;
  const authHeaders = (extra: Record<string, string> = {}) => ({ authorization: token ? `Bearer ${token}` : '', ...extra });
  const authedHeaders = authHeaders;
  const [clientQuery, setClientQuery] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState('No hay una fuente externa conectada. EMPRE no ejecutará un análisis de negocio sin datos autorizados.');
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [companyDraft, setCompanyDraft] = useState<CompanyProfile | null>(company);
  const [companyMessage, setCompanyMessage] = useState('');
  const [nitMessage, setNitMessage] = useState('');
  const [auditEvents, setAuditEvents] = useState<ApiAuditEvent[]>([]);
  const [documents, setDocuments] = useState<Array<[string, string]>>([
    ['Informe mensual.pdf', 'Disponible localmente'], ['Manual operativo.docx', 'Disponible localmente'], ['Contrato cliente.pdf', 'Disponible localmente'],
  ]);
  const [connectorForm, setConnectorForm] = useState({ preset: 'generic_rest', name: '', baseUrl: '', authMode: 'login' as ConnectorSummary['authMode'], healthPath: '/api/health', verificationPath: '/api/me', loginPath: '/api/auth/login', manifestPath: '', apiKeyHeader: 'x-api-key', username: '', secret: '', toolsText: '[]' });
  const [connectorPending, setConnectorPending] = useState(false);
  const [connectorMessage, setConnectorMessage] = useState('');
  const [probeMessage, setProbeMessage] = useState('');
  const [externalClients, setExternalClients] = useState<ExternalClient[]>([]);
  const [externalAppointments, setExternalAppointments] = useState<ExternalAppointment[]>([]);
  const [externalPortfolioCount, setExternalPortfolioCount] = useState(0);
  const [externalToolCount, setExternalToolCount] = useState(0);
  const [slotDate, setSlotDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<ExternalSlot[]>([]);
  const [slotMessage, setSlotMessage] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [actionMessage, setActionMessage] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [actionForm, setActionForm] = useState({ clientName: '', service: '', date: '', time: '', appointmentId: '', appointmentStatus: 'accepted', clientId: '', clientStatus: 'accepted', tool: 'clients.list', inputJson: '{}' });
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string; type: string; status: string; isPse?: boolean }>>([]);
  const [paymentMethodsMessage, setPaymentMethodsMessage] = useState('');
  const [paymentMethodsNotes, setPaymentMethodsNotes] = useState<string[]>([]);
  const [realAiProvider, setRealAiProvider] = useState<'openai' | 'local-kernel'>('local-kernel');

  useEffect(() => {
    function handleConnectorDraft(event: Event) {
      const detail = (event as CustomEvent<{ targetUrl?: string; candidateEndpoints?: string[]; recommendedAuth?: string[] }>).detail;
      if (!detail?.targetUrl) return;
      const candidates = detail.candidateEndpoints ?? [];
      const pickPath = (ending: string, fallback: string) => { const found = candidates.find((item) => item.endsWith(ending)); return found ? new URL(found).pathname : fallback; };
      const recommended = detail.recommendedAuth ?? [];
      const supported = recommended.find((item) => ['login', 'bearer', 'api_key', 'none'].includes(item)) as ConnectorSummary['authMode'] | undefined;
      setConnectorForm((current) => ({ ...current, name: current.name || 'Sistema preparado por EMPRE', baseUrl: detail.targetUrl!, authMode: supported ?? 'login', healthPath: pickPath('/api/health', current.healthPath), verificationPath: pickPath('/api/me', current.verificationPath), loginPath: pickPath('/api/auth/login', current.loginPath) }));
      setConnectorMessage('EMPRE aplicó el plan de descubrimiento al formulario. Revisa y completa la autenticación antes de conectar.');
    }
    window.addEventListener('empre:connector-draft', handleConnectorDraft);
    return () => window.removeEventListener('empre:connector-draft', handleConnectorDraft);
  }, []);

  useEffect(() => setCompanyDraft(company), [company]);
  useEffect(() => {
    if (active !== 'Auditoría' || !token) return;
    fetch(`${apiBaseUrl}/audit`, { headers: { authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : Promise.reject()).then((data: { events?: ApiAuditEvent[] }) => setAuditEvents(data.events ?? [])).catch(() => setAuditEvents([]));
  }, [active, apiBaseUrl, token]);

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/assistant/history`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { messages?: Array<{ role: 'user' | 'assistant'; text: string }> }) => {
        const messages = (data.messages ?? []).map((item) => ({ role: item.role === 'assistant' ? 'ai' as const : 'user' as const, text: item.text }));
        if (messages.length) setChat(messages);
      }).catch(() => undefined);
  }, [apiBaseUrl, token]);

  const clientList = externalClients;
  const filteredClients = useMemo(() => {
    const q = clientQuery.toLowerCase().trim();
    return q ? clientList.filter((client) => `${client.name} ${client.email}`.toLowerCase().includes(q)) : clientList;
  }, [clientQuery, clientList]);

  async function runAnalysis() {
    if (!connection.connected) {
      setAnalysisMessage('Acceso bloqueado: conecta y verifica el sistema de tu empresa en Integraciones antes de ejecutar análisis.');
      return;
    }
    setAnalysisRunning(true);
    try {
      const response = await fetch(`${apiBaseUrl}/connector/probe`, { headers: { authorization: `Bearer ${token ?? ''}` } });
      const data = await response.json().catch(() => ({})) as { connected?: boolean; capabilities?: string[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'No se pudo comprobar el Connector.');
      setAnalysisMessage(`Connector operativo. Capacidades detectadas: ${(data.capabilities ?? []).join(', ') || 'sin capacidades declaradas'}.`);
    } catch (error) { setAnalysisMessage(error instanceof Error ? error.message : 'No se pudo comprobar el Connector.'); }
    finally { setAnalysisRunning(false); }
  }

  async function connectSystem() {
    if (!token || !connectorForm.baseUrl.trim()) return setConnectorMessage('Escribe la URL base del sistema.');
    setConnectorPending(true); setConnectorMessage('Creando y verificando el Connector…'); setProbeMessage('');
    try {
      let tools: unknown[] = [];
      try { tools = JSON.parse(connectorForm.toolsText); } catch { throw new Error('Las capacidades JSON no tienen un formato válido.'); }
      const { toolsText: _toolsText, ...connectorPayload } = connectorForm;
      const createResponse = await fetch(`${apiBaseUrl}/connectors`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ ...connectorPayload, name: connectorForm.name || 'Mi sistema', tools }) });
      const createData = await createResponse.json().catch(() => ({})) as { connector?: ConnectorSummary; message?: string };
      if (!createResponse.ok || !createData.connector) throw new Error(createData.message ?? 'No se pudo crear el Connector.');
      const testResponse = await fetch(`${apiBaseUrl}/connectors/${createData.connector.id}/test`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const testData = await testResponse.json().catch(() => ({})) as { connector?: ConnectorSummary; check?: { message?: string }; message?: string };
      if (!testResponse.ok || !testData.connector) throw new Error(testData.message ?? 'La conexión fue creada pero no pasó la prueba.');
      setConnectorMessage(testData.check?.message ?? 'Conector conectado y verificado.');
      await refreshConnection();
      setConnectorForm((current) => ({ ...current, secret: '' }));
    } catch (error) { setConnectorMessage(error instanceof Error ? error.message : 'No se pudo conectar el sistema.'); }
    finally { setConnectorPending(false); }
  }

  async function probeConnectedSystem() {
    setProbeMessage('Verificando conexión y capacidades…');
    try {
      const response = await fetch(`${apiBaseUrl}/connector/probe`, { headers: { authorization: `Bearer ${token ?? ''}` } });
      const data = await response.json().catch(() => ({})) as { connected?: boolean; connector?: ConnectorSummary; tools?: ConnectorSummary['tools']; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'No se pudo verificar el sistema.');
      await refreshConnection();
      await loadPendingApprovals();
      setProbeMessage(`${data.connector?.name ?? 'Sistema conectado'} verificado. ${data.tools?.length ?? 0} herramientas declaradas.`);
    } catch (error) { setProbeMessage(error instanceof Error ? error.message : 'No se pudo verificar el sistema.'); await refreshConnection(); }
  }

  async function loadPendingApprovals() {
    if (!token || !connection.connected) return;
    try {
      const response = await fetch(`${apiBaseUrl}/connector/actions/pending`, { headers: authedHeaders() });
      if (response.ok) { const data = await response.json() as { approvals?: PendingApproval[] }; setPendingApprovals(data.approvals ?? []); }
    } catch {
      // panel informativo; no bloquea la lectura.
    }
  }

  async function loadAvailableSlots() {
    if (!token || !connection.connected || !slotDate) {
      setSlotMessage('Selecciona una fecha y mantén el Connector operativo.');
      return;
    }
    setSlotMessage('Consultando horarios reales…');
    setAvailableSlots([]);
    try {
      const response = await fetch(`${apiBaseUrl}/connector/actions`, {
        method: 'POST',
        headers: authedHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ tool: 'appointments.slots', input: { date: slotDate } }),
      });
      const data = await response.json().catch(() => ({})) as { result?: { slots?: unknown[] }; status?: string; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'No se pudieron consultar los horarios.');
      const slots = Array.isArray(data.result?.slots) ? data.result!.slots.filter((value): value is string => typeof value === 'string') : [];
      setAvailableSlots(slots);
      setSlotMessage(slots.length ? `${slots.length} horarios disponibles para ${slotDate}.` : 'No hay horarios disponibles para esa fecha.');
    } catch (error) {
      setSlotMessage(error instanceof Error ? error.message : 'No se pudieron consultar los horarios.');
    }
  }

  async function requestConnectorAction(tool: string, input: Record<string, unknown>) {
    if (!token || !connection.connected) { setActionMessage('Acción bloqueada: primero conecta y verifica un sistema externo.'); return; }
    setActionPending(true); setActionMessage('Enviando solicitud al Connector…');
    try {
      const response = await fetch(`${apiBaseUrl}/connector/actions`, { method: 'POST', headers: authedHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ tool, input }) });
      const data = await response.json().catch(() => ({})) as { status?: string; message?: string; approvalId?: string };
      if (!response.ok) throw new Error(data.message ?? 'No se pudo solicitar la acción.');
      setActionMessage(data.status === 'pending_approval' ? `Acción preparada. Aprobación creada: ${data.approvalId ?? 'pendiente'}.` : 'Lectura completada correctamente.');
      await loadPendingApprovals();
      if (tool.endsWith('.list')) await probeConnectedSystem();
    } catch (error) { setActionMessage(error instanceof Error ? error.message : 'No se pudo ejecutar la herramienta.'); }
    finally { setActionPending(false); }
  }

  async function approveConnectorAction(id: string) {
    if (!token || !connection.connected) return;
    setActionPending(true); setActionMessage('Ejecutando acción aprobada…');
    try {
      const response = await fetch(`${apiBaseUrl}/connector/actions/${id}/approve`, { method: 'POST', headers: authedHeaders() });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'No se pudo ejecutar la acción aprobada.');
      setActionMessage('Acción ejecutada y registrada en auditoría.');
      await loadPendingApprovals();
      await probeConnectedSystem();
    } catch (error) { setActionMessage(error instanceof Error ? error.message : 'No se pudo ejecutar la acción.'); }
    finally { setActionPending(false); }
  }

  async function loadPaymentMethods() {
    setPaymentMethodsMessage('Consultando medios disponibles en Mercado Pago…');
    try {
      const response = await fetch(`${apiBaseUrl}/billing/payment-methods`, { headers: authedHeaders() });
      const data = await response.json().catch(() => ({})) as { methods?: Array<{ id: string; name: string; type: string; status: string; isPse?: boolean }>; notes?: string[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'No se pudieron consultar los medios de pago.');
      setPaymentMethods(data.methods ?? []);
      setPaymentMethodsNotes(Array.isArray(data.notes) ? data.notes.map(String) : []);
      setPaymentMethodsMessage(data.methods?.length ? `${data.methods.length} medios/configuraciones disponibles para esta cuenta.` : 'No se devolvieron medios de pago.');
    } catch (error) { setPaymentMethodsMessage(error instanceof Error ? error.message : 'No se pudieron consultar los medios de pago.'); }
  }

  async function disconnectSystem(id: string) {
    if (!token || !window.confirm('¿Desconectar este sistema? EMPRE dejará de ejecutar operaciones sobre él.')) return;
    try {
      const response = await fetch(`${apiBaseUrl}/connectors/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})) as { message?: string }; throw new Error(data.message ?? 'No se pudo desconectar.'); }
      setConnectorMessage('Sistema desconectado.');
      await refreshConnection();
    } catch (error) { setConnectorMessage(error instanceof Error ? error.message : 'No se pudo desconectar.'); }
  }

  async function saveCompany() {
    if (!companyDraft || !token) return;
    setCompanyMessage('Guardando…');
    try {
      const response = await fetch(`${apiBaseUrl}/company/profile`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(companyDraft) });
      const data = await response.json().catch(() => ({})) as { company?: CompanyProfile; message?: string };
      if (!response.ok || !data.company) throw new Error(data.message ?? 'No se pudo guardar.');
      setCompanyDraft(data.company);
      setCompanyMessage('Datos guardados. La verificación oficial del NIT sigue siendo un paso separado.');
      await refreshCompany();
    } catch (error) { setCompanyMessage(error instanceof Error ? error.message : 'No se pudo guardar la empresa.'); }
  }

  async function validateNitDraft() {
    if (!companyDraft || !token) return;
    setNitMessage('Validando formato y dígito de verificación…');
    try {
      const response = await fetch(`${apiBaseUrl}/company/nit/validate`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ nit: companyDraft.nit ?? '', nitDv: companyDraft.nitDv ?? '' }) });
      const data = await response.json() as { message?: string; dv?: string; status?: CompanyProfile['nitVerificationStatus'] };
      setCompanyDraft((current) => current ? { ...current, nitDv: data.dv ?? current.nitDv, nitVerificationStatus: data.status ?? current.nitVerificationStatus } : current);
      setNitMessage(data.message ?? 'Validación realizada.');
    } catch { setNitMessage('No fue posible validar el NIT en este momento.'); }
  }

  function connectorToolCount(currentConnection: DashboardSummary['connection']) { return currentConnection.primary ? (externalToolCount || 7) : 0; }

  return (
    <section className="module-area">
      <div className="module-heading"><div><span className="section-kicker">CENTRO OPERATIVO</span><h1>{active}</h1><p>Los estados marcados como locales no representan conexiones externas reales.</p></div><div className="module-chip"><span className="footer-dot" /> Núcleo local</div></div>

      {active === 'Chat con IA' && <div className="panel module-chat"><div className="panel-header"><div><span className="section-kicker">ASISTENTE</span><h2>Conversa con EMPRE.IA</h2></div><div className="button-row"><span className={`local-badge ${connection.connected ? 'connected-badge' : ''}`}>{realAiProvider === 'openai' ? 'Modelo LLM activo' : 'Núcleo conversacional local'} · {aiStatus.webSearchEnabled ? 'Web en vivo' : 'Sin web'} · {connection.connected ? 'Fuente conectada' : 'Sin fuente externa'}</span><button className="ghost-button" onClick={clearChat} disabled={chatPending}>Limpiar</button></div></div><div className="chat-thread large">{chat.map((item, index) => <div className={`chat-message ${item.role}`} key={`${item.role}-${index}`}><div className="chat-avatar">{item.role === 'ai' ? 'A' : 'TÚ'}</div><div><p>{item.text}</p>{item.role === 'ai' && item.webSearched && <span className="chat-web-badge">🌐 Investigación web en vivo</span>}{item.role === 'ai' && item.agent && <span className="chat-agent-badge">🤖 {item.agent}</span>}{item.role === 'ai' && item.citations && item.citations.length > 0 && <div className="chat-sources"><strong>Fuentes</strong>{item.citations.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}</div></div>)}{chatPending && <div className="chat-message ai"><div className="chat-avatar">A</div><p>{aiStatus.webSearchEnabled ? 'Pensando y, cuando sea necesario, investigando en Internet…' : 'Pensando con el núcleo…'}</p></div>}</div>{chatSuggestedActions.length > 0 && <div className="chat-suggestions">{chatSuggestedActions.map((action) => <button key={action} onClick={() => sendMessage(action)} disabled={chatPending}>{action}</button>)}</div>}<div className="module-composer"><Icon name="spark" /><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="Escribe una solicitud…"/><button onClick={() => sendMessage()} aria-label="Enviar" disabled={chatPending}><Icon name="send"/></button></div><div className="chat-disclaimer">EMPRE separa conversación, datos y ejecución: la IA no puede consultar ni modificar información externa hasta que exista un Connector verificado. Cuando hay un modelo LLM configurado, éste recibe sólo el contexto autorizado que EMPRE prepara. La búsqueda web, cuando está habilitada, usa la herramienta web del proveedor y muestra las fuentes obtenidas.</div></div>}

      {active === 'Análisis' && <div className="module-grid two"><div className="panel module-card"><span className="module-icon cyan"><Icon name="chart" size={22}/></span><h2>{connection.connected ? 'Fuente conectada' : 'Acceso bloqueado'}</h2><p>{connection.connected ? analysisMessage : 'EMPRE no ejecutará análisis de negocio mientras no exista un Connector operativo y autorizado.'}</p><button className="primary-button" onClick={() => connection.connected ? runAnalysis() : openModule('Integraciones')} disabled={analysisRunning}>{analysisRunning ? 'Comprobando…' : connection.connected ? 'Comprobar acceso real' : 'Conectar una fuente'}</button></div><div className="panel module-card"><span className="module-icon purple"><Icon name="shield" size={22}/></span><h2>Regla de operación</h2><p>Una conexión válida habilita herramientas. Un dato no conectado no se puede analizar y un permiso no se asume.</p><div className="usage-box"><div><span>Uso IA</span><strong>{usageText}</strong></div><div><span>Sistema externo</span><strong>{connection.connected ? connection.primary?.name ?? 'Conectado' : 'No conectado'}</strong></div></div></div></div>}

      {['Automatizaciones','Clientes','Documentos','Agentes','Tareas'].includes(active) && !connection.connected && <div className="panel connection-lock"><span className="module-icon orange"><Icon name="shield" size={24}/></span><h2>EMPRE está bloqueada en este módulo</h2><p>No puedes consultar ni modificar información operativa de la empresa porque todavía no existe una conexión externa verificada.</p><ol><li>Abre Integraciones.</li><li>Registra la URL base del sistema.</li><li>Configura autenticación.</li><li>Prueba la conexión.</li><li>Vuelve aquí y EMPRE habilitará las funciones compatibles.</li></ol><button className="primary-button" onClick={() => openModule('Integraciones')}>Conectar mi sistema</button></div>}

      {active === 'Automatizaciones' && connection.connected && <div className="panel module-list-panel"><div className="panel-header"><div><span className="section-kicker">ORQUESTACIÓN</span><h2>Automatizaciones</h2></div><span className="local-badge">Connector operativo</span></div><div className="settings-list">{(summary?.automationsList ?? []).map((item) => <div className="setting-row" key={item.id}><span><strong>{item.name}</strong><small>{item.description} · {item.status === 'active' ? 'Activa' : 'Pausada'}</small></span><button className={`toggle ${item.status === 'active' ? 'on' : ''}`} onClick={() => onAutomationToggle(item.id, item.status === 'active')} aria-label={`Cambiar ${item.name}`}><i/></button></div>)}</div></div>}

      {active === 'Clientes' && connection.connected && <div className="panel module-list-panel"><div className="panel-header"><div><span className="section-kicker">DATOS DEL SISTEMA CONECTADO</span><h2>Clientes</h2></div><div className="mini-search"><Icon name="search" size={15}/><input value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} placeholder="Buscar cliente…"/></div></div><div className="table-like">{filteredClients.length ? filteredClients.map((client) => <div className="table-row" key={client.id}><div><strong>{client.name}</strong><small>{client.email}</small></div><span className={`status-pill ${client.status === 'accepted' || client.status === 'active' ? 'ok' : client.status === 'rejected' ? 'bad' : 'wait'}`}>{client.status === 'accepted' ? 'Aceptada' : client.status === 'rejected' ? 'Rechazada' : client.status === 'active' ? 'Activa' : 'Pendiente'}</span></div>) : <div className="empty-state">El Connector no ha cargado clientes en el panel todavía. Usa “Probar lectura” en Integraciones.</div>}</div></div>}

      {active === 'Documentos' && connection.connected && <div className="panel module-list-panel"><div className="panel-header"><div><span className="section-kicker">CENTRO DOCUMENTAL</span><h2>Documentos</h2></div><span className="local-badge">Fuente conectada</span></div><div className="table-like">{documents.map(([name, status]) => <div className="table-row" key={name}><div><strong>{name}</strong><small>Archivo local de EMPRE</small></div><button className="ghost-button" onClick={() => setDocuments((items) => items.map((item) => item[0] === name ? [item[0], 'Revisado localmente'] : item))}>{status}</button></div>)}</div></div>}

      {active === 'Integraciones' && (
        <div className="integrations-hub">
          <div className="panel connection-hero">
            <div>
              <span className="section-kicker">CONNECTOR HUB</span>
              <h2>
                {connection.connected
                  ? `Sistema conectado: ${connection.primary?.name ?? 'Sistema externo'}`
                  : 'Conecta el sistema de tu empresa'}
              </h2>
              <p>
                {connection.connected
                  ? 'EMPRE ya puede consultar las capacidades declaradas por el Connector. Las acciones con efecto externo siguen sujetas a permisos, políticas y aprobación.'
                  : 'Hasta que esta prueba sea válida, EMPRE no permitirá análisis ni acciones operativas sobre una empresa externa.'}
              </p>
            </div>
            <span className={`connection-status ${connection.connected ? 'connected' : 'locked'}`}>
              {connection.connected ? '● OPERATIVO' : '● BLOQUEADO'}
            </span>
          </div>

          {!connection.connected && (
            <div className="panel connection-steps">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">PASOS DE ACTIVACIÓN</span>
                  <h2>Cómo conectar tu página o sistema</h2>
                </div>
              </div>
              <ol>
                <li>
                  Si sólo tienes una página web pública, no pongas su URL como si fuera una API: EMPRE necesita una API, un SDK/Connector o un webhook que permita operar el sistema.
                </li>
                <li>
                  Elige el tipo de integración e introduce la URL base de esa API o Connector. En producción debe ser HTTPS público o una red privada explícitamente autorizada.
                </li>
                <li>
                  Crea una cuenta técnica de integración con el mínimo permiso posible. Si el sistema admite roles, usa una cuenta dedicada exclusivamente a EMPRE.
                </li>
                <li>
                  Introduce el método de autenticación en este formulario; la contraseña/token se guarda cifrado en el servidor.
                </li>
                <li>
                  EMPRE prueba <code>/api/health</code> y verifica la identidad mediante el endpoint configurado.
                </li>
                <li>
                  Cuando la prueba sea correcta, la conexión cambia a <strong>OPERATIVO</strong>; si falla, ningún módulo operativo se desbloquea.
                </li>
                <li>
                  Haz una primera lectura antes de activar cualquier acción con efectos externos.
                </li>
              </ol>
              <p>EMPRE no necesita acceso directo a la base de datos. El sistema debe exponer una API/Connector/SDK/webhook compatible o requerirá un adaptador específico.</p>
            </div>
          )}

          <div className="panel connector-form">
            <div className="panel-header">
              <div>
                <span className="section-kicker">NUEVA CONEXIÓN</span>
                <h2>Configurar Connector</h2>
              </div>
            </div>
            <div className="form-grid">
              <div className="connector-explainer">
                <strong>Connector universal de EMPRE.IA</strong>
                <span>Esta conexión no pertenece a una empresa concreta. Configura aquí la API o Connector de cualquier sitio o sistema compatible. Suldery será sólo una prueba posterior.</span>
              </div>
              <label>
                Nombre de la conexión
                <input
                  value={connectorForm.name}
                  onChange={(event) => setConnectorForm({ ...connectorForm, name: event.target.value })}
                  placeholder="Mi sistema"
                />
              </label>
              <label>
                URL base del sistema
                <input
                  value={connectorForm.baseUrl}
                  onChange={(event) => setConnectorForm({ ...connectorForm, baseUrl: event.target.value })}
                  placeholder="https://tu-sistema.com"
                  required
                />
              </label>
              <label>
                Método de autenticación
                <select
                  value={connectorForm.authMode}
                  onChange={(event) => setConnectorForm({ ...connectorForm, authMode: event.target.value as ConnectorSummary['authMode'] })}
                >
                  <option value="login">Login → token</option>
                  <option value="bearer">Bearer token</option>
                  <option value="api_key">API Key</option>
                  <option value="none">Sin autenticación</option>
                </select>
              </label>

              <label>
                Ruta de manifest (opcional)
                <input value={connectorForm.manifestPath} onChange={(event) => setConnectorForm({ ...connectorForm, manifestPath: event.target.value })} placeholder="/empre/manifest" />
                <small>Si tu sistema publica un manifest de EMPRE, puede declarar automáticamente sus herramientas.</small>
              </label>

              {connectorForm.authMode === 'login' && (
                <>
                  <label>
                    Correo/usuario de integración
                    <input
                      value={connectorForm.username}
                      onChange={(event) => setConnectorForm({ ...connectorForm, username: event.target.value })}
                      placeholder="cuenta-integradora@empresa.com"
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Contraseña de integración
                    <input
                      type="password"
                      value={connectorForm.secret}
                      onChange={(event) => setConnectorForm({ ...connectorForm, secret: event.target.value })}
                      autoComplete="new-password"
                    />
                  </label>
                </>
              )}

              {connectorForm.authMode === 'bearer' && (
                <label>
                  Bearer token
                  <input
                    type="password"
                    value={connectorForm.secret}
                    onChange={(event) => setConnectorForm({ ...connectorForm, secret: event.target.value })}
                    autoComplete="new-password"
                  />
                </label>
              )}

              {connectorForm.authMode === 'api_key' && (
                <>
                  <label>
                    Nombre del header
                    <input
                      value={connectorForm.apiKeyHeader}
                      onChange={(event) => setConnectorForm({ ...connectorForm, apiKeyHeader: event.target.value })}
                      placeholder="x-api-key"
                    />
                  </label>
                  <label>
                    API Key
                    <input
                      type="password"
                      value={connectorForm.secret}
                      onChange={(event) => setConnectorForm({ ...connectorForm, secret: event.target.value })}
                      autoComplete="new-password"
                    />
                  </label>
                </>
              )}

              <label>
                Ruta de health
                <input
                  value={connectorForm.healthPath}
                  onChange={(event) => setConnectorForm({ ...connectorForm, healthPath: event.target.value })}
                />
              </label>
              <label>
                Ruta de verificación
                <input
                  value={connectorForm.verificationPath}
                  onChange={(event) => setConnectorForm({ ...connectorForm, verificationPath: event.target.value })}
                />
              </label>
              {connectorForm.authMode === 'login' && (
                <label>
                  Ruta de login
                  <input
                    value={connectorForm.loginPath}
                    onChange={(event) => setConnectorForm({ ...connectorForm, loginPath: event.target.value })}
                  />
                </label>
              )}
              <label className="full-width-field">
                Capacidades declaradas (JSON)
                <textarea rows={8} value={connectorForm.toolsText} onChange={(event) => setConnectorForm({ ...connectorForm, toolsText: event.target.value })} spellCheck={false} />
                <small>Ejemplo: <code>{`[{"name":"clients.list","method":"GET","path":"/api/clients","readOnly":true}]`}</code>. Usa sólo rutas reales del sistema. Las acciones de escritura pasan por aprobación.</small>
              </label>

            </div>
            <div className="button-row">
              <button className="primary-button" onClick={connectSystem} disabled={connectorPending}>
                {connectorPending ? 'Verificando…' : 'Conectar y verificar'}
              </button>
              {connectorMessage && <small className="save-note">{connectorMessage}</small>}
            </div>
            <p className="legal-note">
              Las credenciales se envían al backend y se guardan cifradas. Para producción configura también una clave maestra en el servidor. Nunca introduzcas credenciales de producción en el chat.
            </p>
          </div>

          <div className="module-grid two">
            <div className="panel module-card">
              <span className="module-icon green"><Icon name="check" size={22} /></span>
              <h2>Prueba de lectura</h2>
              <p>Consulta el sistema externo mediante el Connector. No se usan datos de demostración para declarar que una conexión está activa.</p>
              <button className="primary-button" onClick={probeConnectedSystem} disabled={!connection.connected}>
                Probar lectura real
              </button>
              {probeMessage && <small className="save-note">{probeMessage}</small>}
            </div>
            <div className="panel module-card">
              <span className="module-icon orange"><Icon name="shield" size={22} /></span>
              <h2>Conexiones existentes</h2>
              {connection.connectors.length
                ? connection.connectors.map((item) => (
                    <div className="connector-existing" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.status} · {item.baseUrl}</small>
                      </div>
                      <button className="ghost-button" onClick={() => disconnectSystem(item.id)}>Desconectar</button>
                    </div>
                  ))
                : <p>No hay conectores configurados.</p>}
            </div>
          </div>
        </div>
      )}

      {active === 'Agentes' && <div className="panel module-list-panel"><div className="panel-header"><div><span className="section-kicker">NÚCLEO MULTIAGENTE</span><h2>Agentes especializados</h2></div><span className="local-badge">Orquestador EMPRE</span></div><p className="core-intro">EMPRE separa responsabilidades: un orquestador decide qué agente participa y cada agente trabaja sólo con las herramientas que tiene autorizadas.</p><div className="agent-grid">{['General','Investigación web','Ventas','Clientes','Citas','Documentos','Automatizaciones','Sistema','Connector','Seguridad'].map((name) => <article className="agent-card" key={name}><span className="module-icon cyan"><Icon name="robot" size={18}/></span><strong>{name}</strong><small>Especialista</small></article>)}</div></div>}

      {active === 'Agentes' && connection.connected && <div className="panel module-list-panel"><div className="panel-header"><div><span className="section-kicker">ORQUESTACIÓN</span><h2>Agentes</h2></div><span className="local-badge">Connector operativo</span></div><div className="settings-list">{(summary?.agentsList ?? []).map((item) => { const running = agentsState[item.id] ?? item.status === 'active'; return <div className="setting-row" key={item.id}><span><strong>{item.name}</strong><small>{item.description} · {running ? 'Activo' : 'Pausado'}</small></span><button className={`toggle ${running ? 'on' : ''}`} onClick={() => onAgentToggle(item.id, running)} aria-label={`Cambiar ${item.name}`}><i/></button></div>; })}</div></div>}

      {active === 'Tareas' && connection.connected && <div className="panel module-list-panel"><div className="panel-header"><div><span className="section-kicker">EJECUCIÓN</span><h2>Tareas</h2></div><span className="local-badge">Connector operativo</span></div><div className="settings-list">{(summary?.recentTasks ?? []).map((item) => { const done = taskDone[item.id] ?? item.status === 'done'; return <button className="task-row module-task" key={item.id} onClick={() => onTaskToggle(item.id, done)}><span className={`task-check ${done ? 'done' : ''}`}>{done && <Icon name="check" size={12}/>}</span><span><strong>{item.title}</strong><small>{done ? 'Completada' : item.detail}</small></span></button>; })}</div></div>}

      {active === 'Mi empresa' && companyDraft && <div className="module-grid two"><div className="panel module-card wide-card"><div className="panel-header"><div><span className="section-kicker">IDENTIDAD LEGAL</span><h2>Datos de la empresa</h2></div><span className={`verification-pill ${companyDraft.legalSetupCompleted ? 'ok' : 'wait'}`}>{companyDraft.legalSetupCompleted ? 'Configuración completa' : 'Pendiente'}</span></div><div className="form-grid"><label>Nombre comercial<input value={companyDraft.name} disabled /></label><label>País<select value={companyDraft.countryCode} onChange={(event) => setCompanyDraft({ ...companyDraft, countryCode: event.target.value })}><option value="CO">Colombia</option></select></label><label>Tipo de organización<select value={companyDraft.businessType} onChange={(event) => setCompanyDraft({ ...companyDraft, businessType: event.target.value as CompanyProfile['businessType'] })}><option value="legal_entity">Empresa constituida / persona jurídica</option><option value="natural_person">Persona natural con actividad económica</option><option value="informal">Emprendimiento no constituido</option></select></label><label>¿Está registrada formalmente?<select value={companyDraft.legalRegistered ? 'yes' : 'no'} onChange={(event) => setCompanyDraft({ ...companyDraft, legalRegistered: event.target.value === 'yes' })}><option value="yes">Sí</option><option value="no">No</option></select></label>{companyDraft.legalRegistered && <><label>Razón social / nombre legal<input value={companyDraft.legalName ?? ''} onChange={(event) => setCompanyDraft({ ...companyDraft, legalName: event.target.value })} required /></label><label>NIT (sin DV)<input inputMode="numeric" value={companyDraft.nit ?? ''} onChange={(event) => setCompanyDraft({ ...companyDraft, nit: event.target.value.replace(/\D/g, '') })} required /></label><label>Dígito de verificación<input inputMode="numeric" maxLength={1} value={companyDraft.nitDv ?? ''} onChange={(event) => setCompanyDraft({ ...companyDraft, nitDv: event.target.value.replace(/\D/g, '').slice(0, 1) })} required /></label></>}<label>Situación tributaria declarada<select value={companyDraft.taxDeclaration} onChange={(event) => setCompanyDraft({ ...companyDraft, taxDeclaration: event.target.value as CompanyProfile['taxDeclaration'] })}><option value="unknown">No lo sé todavía</option><option value="obligated">Tengo obligaciones tributarias</option><option value="not_obligated">No tengo obligaciones tributarias / no me aplican</option></select></label></div>{companyDraft.legalRegistered && <div className="verification-box"><strong>Estado del NIT: {statusLabel(companyDraft.nitVerificationStatus)}</strong><p>La validación local comprueba el formato y el dígito de verificación. No se considera una verificación oficial ante la DIAN.</p><div className="button-row"><button className="ghost-button" onClick={validateNitDraft}>Validar formato y DV</button><a className="ghost-button inline-button" href="https://www.vue.gov.co/tramites-y-consultas/consulta-de-estado-del-rut" target="_blank" rel="noreferrer">Abrir consulta oficial</a></div>{nitMessage && <small>{nitMessage}</small>}</div>}<button className="primary-button" onClick={saveCompany}>Guardar datos legales</button>{companyMessage && <small className="save-note">{companyMessage}</small>}<p className="legal-note">Estos campos describen la información declarada por la empresa. EMPRE no debe presentar una declaración del cliente como prueba automática de cumplimiento tributario.</p></div><div className="panel module-card"><span className="module-icon cyan"><Icon name="shield" size={22}/></span><h2>Por qué pedimos esto</h2><p>La identidad legal permite preparar facturación y políticas de servicio sin inventar la situación tributaria de la empresa. Para Colombia, la consulta del estado del RUT puede contrastarse con bases de la DIAN mediante canales oficiales.</p><p>La verificación oficial del NIT/RUT quedará separada de la validación local del dígito de verificación.</p></div></div>}

      {active === 'Planes y facturación' && <div className="module-area billing-area">{billingReturnMessage && <div className="panel billing-return-banner"><strong>{billingReturnMessage}</strong></div>}<div className="billing-head panel"><div><span className="section-kicker">SUSCRIPCIÓN</span><h2>Elige cómo quieres usar EMPRE.IA</h2><p>Los precios del MVP son una propuesta comercial. El checkout real sólo se activa cuando Mercado Pago está configurado en el servidor.</p></div><div className="billing-switch"><button className={billingCycle === 'monthly' ? 'active' : ''} onClick={() => setBillingCycle('monthly')}>Mensual</button><button className={billingCycle === 'annual' ? 'active' : ''} onClick={() => setBillingCycle('annual')}>Anual</button></div></div><div className="plan-grid">{commercialPlans.map((plan) => { const current = plan.id === summary?.plan.id; const price = billingCycle === 'annual' ? plan.annual : plan.monthly; return <article key={plan.id} className={`plan-card ${plan.id} ${current ? 'current' : ''}`}><div className="plan-top"><strong>{plan.name}</strong>{current && <span>ACTUAL</span>}</div><h3>{money(price)}<small>{plan.id === 'free' ? '' : billingCycle === 'annual' ? ' / año' : ' / mes'}</small></h3><p>{plan.audience}</p><small>{plan.level}</small><small>{plan.credits}</small><div className="plan-highlights">{plan.highlights.map((item) => <span key={item}>✓ {item}</span>)}</div>{current ? <button className="ghost-button plan-select" disabled>Plan actual</button> : plan.id === 'free' ? <button className="ghost-button plan-select" onClick={() => onPlanChange('free')}>Usar Free local</button> : <div className="plan-actions"><button className="primary-button" onClick={() => onCheckout(plan.id, billingCycle)}>{billing?.method === 'checkout-pro-orders' ? 'Continuar con Mercado Pago' : billing?.method === 'payment-link' ? 'Abrir Link de Pago' : 'Configurar pago'}</button><button className="ghost-button" onClick={() => onPlanChange(plan.id)}>Simular localmente</button></div>}</article>; })}</div><div className="billing-status panel"><div><strong>Proveedor de pago</strong><span>Mercado Pago</span></div><div><strong>Servidor</strong><span>{billing?.configured ? `Configurado · ${billing.environment}` : 'No configurado'}</span></div><div><strong>Plan actual</strong><span>{planName}</span></div><div><strong>Uso IA</strong><span>{usageText}</span></div><p>{billing?.message ?? 'Comprueba la configuración del servidor para activar pagos reales.'}</p>{billing?.method === 'checkout-pro-orders' ? <p className="payment-method-note">El checkout integrado consulta los medios habilitados para la cuenta de Mercado Pago. En Colombia existe PSE y la documentación de Mercado Pago muestra a NEQUI dentro de las instituciones financieras de PSE; la disponibilidad concreta depende de la cuenta y del checkout.</p> : billing?.method === 'payment-link' ? <p className="payment-method-note">Este Link de Pago es sólo respaldo manual. No identifica automáticamente qué empresa pagó ni activa el plan por sí solo.</p> : null}</div><div className="tax-note panel"><strong>Impuestos y precio final</strong><p>EMPRE no añadirá automáticamente una tasa fiscal sólo porque la empresa haya indicado que está registrada. El tratamiento de impuestos debe depender de la configuración fiscal real del vendedor y de la normativa aplicable al servicio en el momento del cobro.</p></div></div>}

      {active === 'Planes y facturación' && <div className="panel payment-method-panel"><div className="panel-header"><div><span className="section-kicker">MEDIOS DE PAGO</span><h2>Medios disponibles en tu cuenta de Mercado Pago</h2><p>El Link de Pago puede quedar como respaldo manual. Para activar planes automáticamente, EMPRE usa credenciales server-side y verifica el pago mediante webhook y consulta de estado.</p></div><button className="ghost-button" onClick={loadPaymentMethods}>Consultar medios disponibles</button></div>{paymentMethodsMessage && <p className="payment-method-message">{paymentMethodsMessage}</p>}{paymentMethods.length > 0 && <div className="payment-method-grid">{paymentMethods.filter(item => item.status === 'active').slice(0,16).map(item => <span className="payment-method-chip" key={item.id}>{item.name}{item.isPse ? ' · PSE' : ''} <small>{item.type}</small></span>)}</div>}{paymentMethodsNotes.length > 0 && <div className="payment-method-notes">{paymentMethodsNotes.map(note => <p key={note}>{note}</p>)}</div>}<div className="payment-link-fallback"><strong>Link manual de respaldo</strong><span>{billing?.hasPaymentLink ? 'Configurado en el servidor' : 'No configurado en .env'}</span><small>Tu Link de Pago puede mostrar menos medios que el checkout integrado. EMPRE no lo usa como confirmación automática de quién pagó o qué plan debe activar.</small></div></div>}

      {active === 'Integraciones' && connection.connected && <div className="connector-workbench">
        <div className="panel connector-workbench-head"><div><span className="section-kicker">CONNECTOR HUB UNIVERSAL</span><h2>{connection.primary?.name ?? 'Sistema conectado'}</h2><p>EMPRE trabaja sólo con las capacidades que este sistema declara y que la conexión puede verificar.</p></div><button className="primary-button" onClick={probeConnectedSystem} disabled={actionPending}>Verificar conexión</button></div>
        <div className="module-grid two">
          <div className="panel module-card"><span className="module-icon green"><Icon name="check" size={22}/></span><h2>Capacidades declaradas</h2>{(connection.primary?.tools ?? []).length ? <div className="settings-list">{(connection.primary?.tools ?? []).map((tool) => <div className="setting-row" key={tool.name}><span><strong>{tool.name}</strong><small>{tool.method} {tool.path} · {tool.readOnly ? 'Sólo lectura' : 'Puede modificar datos'}</small></span></div>)}</div> : <div className="empty-state">No hay herramientas declaradas. Añade un manifest o configura las capacidades del Connector.</div>}</div>
          <div className="panel module-card"><span className="module-icon purple"><Icon name="shield" size={22}/></span><h2>Seguridad de operación</h2><p>Una conexión activa no significa acceso ilimitado. Cada herramienta tiene su ruta, método y condición de lectura/escritura. Las escrituras requieren aprobación.</p><button className="ghost-button" onClick={() => openModule('Configuración')}>Ver seguridad</button></div>
        </div>
        <div className="panel module-card"><span className="module-icon cyan"><Icon name="database" size={22}/></span><h2>Prueba genérica de herramienta</h2><p>Selecciona cualquier herramienta declarada y proporciona parámetros JSON. Este mismo flujo sirve para una clínica, tienda, ERP, CRM, página web con API o cualquier otro sistema compatible.</p><div className="form-grid compact"><label>Herramienta<select value={actionForm.tool} onChange={(event) => setActionForm({...actionForm, tool:event.target.value})}>{(connection.primary?.tools ?? []).map(tool => <option key={tool.name} value={tool.name}>{tool.name}</option>)}</select></label><label>Parámetros JSON<textarea rows={5} value={actionForm.inputJson} onChange={e => setActionForm({...actionForm, inputJson:e.target.value})} spellCheck={false}/></label></div><button className="primary-button" disabled={actionPending || !(connection.primary?.tools ?? []).length} onClick={() => { let input: Record<string, unknown> = {}; try { input = JSON.parse(actionForm.inputJson || '{}'); } catch { setActionMessage('JSON de parámetros inválido.'); return; } requestConnectorAction(actionForm.tool, input); }}>Probar herramienta</button>{actionMessage && <div className="action-message"><strong>{actionMessage}</strong></div>}</div>
        <div className="panel approval-panel"><div className="panel-header"><div><span className="section-kicker">APROBACIONES</span><h2>Acciones pendientes</h2></div><span className="local-badge">{pendingApprovals.length} pendientes</span></div>{pendingApprovals.length ? pendingApprovals.map(item => <div className="approval-row" key={item.id}><div><strong>{item.tool}</strong><small>{JSON.stringify(item.input)} · {new Date(item.createdAt).toLocaleString('es-CO')}</small></div><button className="primary-button" onClick={() => approveConnectorAction(item.id)} disabled={actionPending}>Aprobar y ejecutar</button></div>) : <div className="empty-state">No hay acciones pendientes.</div>}</div>
      </div>}

      {active === 'Configuración' && <div className="module-grid two"><div className="panel module-card"><span className="module-icon purple"><Icon name="settings" size={22}/></span><h2>Preferencias</h2><p>El núcleo local opera en modo supervisado, con memoria por empresa y acciones sensibles sujetas a políticas.</p><button className="primary-button" onClick={() => openModule('Planes y facturación')}>Ver planes y facturación</button></div><div className="panel module-card"><span className="module-icon cyan"><Icon name="robot" size={22}/></span><h2>Constitución de EMPRE</h2><div className="usage-box"><div><span>Proveedor IA</span><strong>Pendiente</strong></div><div><span>Autonomía</span><strong>Supervisada</strong></div><div><span>Memoria</span><strong>Por empresa</strong></div><div><span>Fuente externa</span><strong>Sin conectar</strong></div></div></div><div className="panel module-list-panel"><div className="panel-header"><div><span className="section-kicker">POR QUÉ EMPRE</span><h2>La diferencia que queremos construir</h2></div></div><div className="settings-list">{differentiators.map(([title, description]) => <div className="setting-row explanation-row" key={title}><span><strong>{title}</strong><small>{description}</small></span></div>)}</div></div></div>}

      {active === 'Auditoría' && <div className="panel module-list-panel"><div className="panel-header"><div><span className="section-kicker">TRAZABILIDAD</span><h2>Auditoría</h2></div><span className="local-badge">Últimos 50 eventos</span></div><div className="table-like">{auditEvents.length ? auditEvents.map((event) => <div className="table-row" key={event.id}><div><strong>{event.action}</strong><small>{event.resource_type} · {new Date(event.created_at).toLocaleString('es-CO')}</small></div><span className={`status-pill ${event.result === 'success' ? 'ok' : 'wait'}`}>{event.result}</span></div>) : <div className="empty-state">No hay eventos para mostrar.</div>}</div></div>}
    </section>
  );

  async function onTaskToggle(taskId: string, done: boolean) {
    if (!props.token) return;
    await fetch(`${props.apiBaseUrl}/dashboard/tasks/${taskId}`, { method: 'PATCH', headers: { authorization: `Bearer ${props.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: done ? 'pending' : 'done' }) });
    setTaskDone((state) => ({ ...state, [taskId]: !done }));
  }
  async function onAgentToggle(id: string, running: boolean) {
    if (!props.token) return;
    await fetch(`${props.apiBaseUrl}/dashboard/agents/${id}`, { method: 'PATCH', headers: { authorization: `Bearer ${props.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: running ? 'paused' : 'active' }) });
    setAgentsState((state) => ({ ...state, [id]: !running }));
  }
  async function onAutomationToggle(id: string, running: boolean) {
    if (!props.token) return;
    await fetch(`${props.apiBaseUrl}/dashboard/automations/${id}`, { method: 'PATCH', headers: { authorization: `Bearer ${props.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: running ? 'paused' : 'active' }) });
  }
}

export default function Dashboard({ api, onLogout }: { api: ApiState; onLogout: () => void }) {
  const [active, setActive] = useState('Inicio');
  const [dark, setDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chat, setChat] = useState(initialChat as ChatMessage[]);
  const [chatSuggestedActions, setChatSuggestedActions] = useState<string[]>(['¿Qué puedes hacer?', '¿Qué tienes conectado?', '¿Cuál es mi plan?']);
  const [input, setInput] = useState('');
  const [chatPending, setChatPending] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>({ configured: false, provider: 'local-kernel', webSearchEnabled: false, webSearchMode: 'disabled' });
  const [realAiProvider, setRealAiProvider] = useState<'openai' | 'local-kernel'>('local-kernel');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>({});
  const [agentsState, setAgentsState] = useState<Record<string, boolean>>({});
  const [integrationState, setIntegrationState] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingReturnMessage, setBillingReturnMessage] = useState('');
  const [connection, setConnection] = useState<DashboardSummary['connection']>({ connected: false, primary: null, connectors: [] });
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('empre-token') : null;

  const authedHeaders = (extra: Record<string, string> = {}) => ({ authorization: token ? `Bearer ${token}` : '', ...extra });

  async function refreshCore() {
    if (!token) return;
    const results = await Promise.all([
      fetch(`${apiBaseUrl}/dashboard/summary`, { headers: authedHeaders() }),
      fetch(`${apiBaseUrl}/auth/me`, { headers: authedHeaders() }),
      fetch(`${apiBaseUrl}/company/profile`, { headers: authedHeaders() }),
      fetch(`${apiBaseUrl}/billing/status`, { headers: authedHeaders() }),
      fetch(`${apiBaseUrl}/connectors`, { headers: authedHeaders() }),
      fetch(`${apiBaseUrl}/ai/status`, { headers: authedHeaders() }),
    ]);
    const [summaryResponse, meResponse, companyResponse, billingResponse, connectorsResponse, aiStatusResponse] = results;
    if (!summaryResponse.ok || !meResponse.ok) throw new Error('core');
    setSummary(await summaryResponse.json());
    setCurrentUser((await meResponse.json()).user);
    if (companyResponse.ok) setCompany((await companyResponse.json()).company);
    if (billingResponse.ok) setBilling((await billingResponse.json()).provider);
    if (connectorsResponse.ok) setConnection(await connectorsResponse.json());
    if (aiStatusResponse.ok) setAiStatus(await aiStatusResponse.json());
  }

  useEffect(() => { refreshCore().catch(() => { setSummary(null); setCurrentUser(null); }); }, [apiBaseUrl, token]);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get('checkout');
    const billingState = params.get('billing');
    if (!checkoutId) return;
    const messageByState: Record<string, string> = {
      success: 'Mercado Pago volvió a EMPRE.IA. Estamos verificando el pago y activaremos el plan sólo cuando Mercado Pago confirme un pago acreditado.',
      pending: 'El pago quedó pendiente. EMPRE no cambiará el plan hasta recibir una confirmación válida de Mercado Pago.',
      failure: 'El pago no fue acreditado. El plan actual de la empresa no se modificó.',
    };
    setBillingReturnMessage(messageByState[billingState ?? ''] ?? 'Regresaste del checkout. EMPRE verificará el estado antes de modificar el plan.');
    fetch(`${apiBaseUrl}/billing/checkout-status?checkoutId=${encodeURIComponent(checkoutId)}`, { headers: authedHeaders() })
      .then((response) => response.json().catch(() => ({})) as Promise<{ activated?: boolean; status?: string; statusDetail?: string; message?: string }>)
      .then((data) => {
        if (data.activated) setBillingReturnMessage('Pago confirmado por Mercado Pago. El plan de esta empresa fue activado correctamente.');
        else if (data.message) setBillingReturnMessage(data.message);
        return refreshCore();
      })
      .catch(() => undefined)
      .finally(() => {
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
      });
  }, [apiBaseUrl, token]);

  const apiText = api.available ? 'Núcleo local operativo' : 'Núcleo local sin conexión';
  const externalText = connection.connected ? `Conectado · ${connection.primary?.name ?? 'sistema'}` : 'Sistema externo no conectado';
  const apiClass = api.available ? 'online' : 'offline';
  const companyName = summary?.tenantName ?? currentUser?.tenantName ?? 'Mi empresa';
  const displayName = currentUser?.name ?? 'Usuario';
  const initials = displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'EM';
  const roleLabel = currentUser?.role === 'owner' ? 'Propietario' : currentUser?.role === 'admin' ? 'Administrador' : currentUser?.role === 'operator' ? 'Operador' : 'Visualizador';
  const planName = summary?.plan.name ?? 'Free';
  const usageText = summary ? `${summary.usage.used.toLocaleString('es-CO')} / ${summary.usage.limit.toLocaleString('es-CO')}` : '—';
  const liveKpis = [
    { label: connection.connected ? 'Herramientas externas' : 'Sistema externo', value: connection.connected ? String(connection.primary?.tools.length ?? 0) : '—', detail: connection.connected ? 'Capacidades verificadas' : 'Bloqueado hasta conectar', icon: 'integrations' as IconName, tone: 'cyan' },
    { label: 'Tareas pendientes', value: summary?.tasks.toLocaleString('es-CO') ?? '—', detail: connection.connected ? 'Operación EMPRE' : 'Bloqueadas sin fuente', icon: 'tasks' as IconName, tone: 'orange' },
    { label: 'Agentes activos', value: summary?.agents.toLocaleString('es-CO') ?? '—', detail: connection.connected ? 'Supervisados' : 'Bloqueados sin fuente', icon: 'robot' as IconName, tone: 'purple' },
    { label: 'Automatizaciones', value: summary?.automations.toLocaleString('es-CO') ?? '—', detail: connection.connected ? 'Disponibles con Connector' : 'Bloqueadas sin fuente', icon: 'zap' as IconName, tone: 'green' },
  ];
  const searchResults = useMemo(() => { const q = query.trim().toLowerCase(); return q ? navItems.filter((item) => item.label.toLowerCase().includes(q)) : navItems.slice(0, 6); }, [query]);
  const openModule = (label: string) => { setActive(label); setQuery(''); setMobileOpen(false); setNotificationsOpen(false); setHelpOpen(false); setProfileOpen(false); };

  const refreshConnection = async () => {
    if (!token) return;
    const response = await fetch(`${apiBaseUrl}/connectors`, { headers: authedHeaders() });
    if (response.ok) { const data = await response.json(); setConnection(data); if (!data.connected) { setExternalClients([]); setExternalAppointments([]); setExternalPortfolioCount(0); setPendingApprovals([]); } }
  };

  async function sendMessage(message = input) {
    const text = message.trim();
    if (!text || chatPending) return;
    setChat((prev) => [...prev, { role: 'user', text }]); setInput(''); setActive('Chat con IA'); setChatPending(true);
    try {
      const response = await fetch(`${apiBaseUrl}/assistant`, { method: 'POST', headers: authedHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ message: text }) });
      const data = await response.json().catch(() => ({})) as { reply?: string; suggestedActions?: string[]; provider?: 'openai' | 'local-kernel'; citations?: ChatCitation[]; webSearched?: boolean; agent?: string };
      if (data.provider) setRealAiProvider(data.provider);
      if (!response.ok) throw new Error(data.reply ?? 'No se pudo procesar la solicitud.');
      setChat((prev) => [...prev, { role: 'ai', text: data.reply ?? 'No recibí una respuesta del núcleo.', citations: Array.isArray(data.citations) ? data.citations : [], webSearched: Boolean(data.webSearched), agent: data.agent }]);
      setChatSuggestedActions(Array.isArray(data.suggestedActions) ? data.suggestedActions : []);
    } catch (error) { setChat((prev) => [...prev, { role: 'ai', text: error instanceof Error ? error.message : 'No se pudo procesar la solicitud.' }]); }
    finally { setChatPending(false); }
  }

  async function clearChat() {
    try {
      if (token) await fetch(`${apiBaseUrl}/assistant/clear`, { method: 'POST', headers: authedHeaders() });
    } catch {
      // La UI igualmente se limpia; el servidor conservará el historial si la petición falla.
    }
    setChat(initialChat);
    setChatSuggestedActions(['¿Qué puedes hacer?', '¿Qué tienes conectado?', '¿Cuál es mi plan?']);
    setInput('');
    setRealAiProvider(aiStatus.provider);
  }

  async function onPlanChange(planId: PlanId) {
    try {
      const response = await fetch(`${apiBaseUrl}/billing/plan`, { method: 'PATCH', headers: authedHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ planId }) });
      const data = await response.json() as { plan?: DashboardSummary['plan']; usage?: DashboardSummary['usage'] };
      if (!response.ok || !data.plan || !data.usage) throw new Error('No se pudo cambiar el plan local.');
      setSummary((current) => current ? { ...current, plan: data.plan!, usage: data.usage! } : current);
    } catch (error) { setChat((prev) => [...prev, { role: 'ai', text: error instanceof Error ? error.message : 'No se pudo cambiar el plan local.' }]); }
  }

  async function onCheckout(planId: Exclude<PlanId, 'free'>, cycle: BillingCycle) {
    try {
      const response = await fetch(`${apiBaseUrl}/billing/checkout`, { method: 'POST', headers: authedHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ planId, billingCycle: cycle }) });
      const data = await response.json().catch(() => ({})) as { checkoutUrl?: string; message?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.message ?? 'Mercado Pago todavía no está configurado en el servidor.');
      window.location.href = data.checkoutUrl;
    } catch (error) { setActive('Planes y facturación'); window.alert(error instanceof Error ? error.message : 'No se pudo preparar el pago.'); }
  }

  return <div className={`app-shell ${dark ? 'theme-dark' : 'theme-light'}`}>
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Icon name="robot" size={25}/></div><div><div className="brand-name">EMPRE<span>.IA</span></div><div className="brand-tag">Tu empresa, más inteligente</div></div></div>
      <nav className="nav">{navItems.map((item) => { const locked = ['Análisis','Automatizaciones','Clientes','Documentos','Agentes','Tareas'].includes(item.label) && !connection.connected; return <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''} ${locked ? 'locked' : ''}`} onClick={() => openModule(item.label)}><Icon name={item.icon}/><span>{item.label}</span>{locked && <small className="nav-lock">LOCK</small>}{item.label === 'Tareas' && summary && connection.connected && <span className="nav-badge">{summary.tasks}</span>}</button>; })}</nav>
      <div className="sidebar-bottom"><button className="company-card" onClick={() => openModule('Mi empresa')}><div className="company-icon">✦</div><div><strong>{companyName}</strong><span>Plan {planName}</span></div><Icon name="arrow" size={15}/></button><button className="user-card" onClick={() => setProfileOpen((value) => !value)}><div className="avatar">{initials}</div><div className="user-copy"><strong>{displayName}</strong><span>{roleLabel}</span></div><span className="online-dot"/></button><div className="pro-card"><div className="pro-glow"/><span className="pro-kicker">EMPRE.IA {planName}</span><strong>{planName === 'Free' ? 'Conoce las capacidades empresariales de EMPRE.' : `Tienes ${usageText} unidades de IA este mes.`}</strong><button onClick={() => openModule('Planes y facturación')}>Ver planes</button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="menu-button" aria-label="Abrir menú" onClick={() => setMobileOpen((value) => !value)}><span/><span/><span/></button><div className="search-box"><Icon name="search" size={18}/><input aria-label="Buscar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en EMPRE.IA…"/><kbd>Ctrl K</kbd>{query && <div className="search-popover">{searchResults.length ? searchResults.map((item) => <button key={item.label} onClick={() => openModule(item.label)}><Icon name={item.icon} size={16}/>{item.label}</button>) : <span>No encontramos ese módulo.</span>}</div>}</div><div className="top-actions"><div className={`system-status ${apiClass}`}><span className="status-pulse"/><span>Estado del núcleo</span><strong>{apiText}</strong></div><button className="icon-button" aria-label="Cambiar tema" onClick={() => setDark((value) => !value)}>{dark ? <Icon name="sun"/> : <Icon name="moon"/>}</button><button className="icon-button notification" aria-label="Notificaciones" onClick={() => { setNotificationsOpen((value) => !value); setHelpOpen(false); setProfileOpen(false); }}><Icon name="bell"/><span>3</span></button><button className="icon-button" aria-label="Ayuda" onClick={() => { setHelpOpen((value) => !value); setNotificationsOpen(false); setProfileOpen(false); }}><Icon name="help"/></button><button className="profile-button" aria-label="Perfil" onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); setHelpOpen(false); }}><span className="avatar small">{initials}</span><span className="profile-copy"><strong>{displayName}</strong><small>{roleLabel}</small></span><Icon name="arrow" size={16}/></button></div>
        {notificationsOpen && <div className="floating-popover notifications-popover"><div className="popover-head"><strong>Notificaciones</strong><button onClick={() => setNotificationsOpen(false)}><Icon name="close" size={15}/></button></div><p>Son avisos del núcleo local. Las alertas reales llegarán cuando existan fuentes conectadas.</p><button onClick={() => openModule('Tareas')}>Revisar tareas <Icon name="arrow" size={14}/></button></div>}
        {helpOpen && <div className="floating-popover help-popover"><div className="popover-head"><strong>Centro de ayuda</strong><button onClick={() => setHelpOpen(false)}><Icon name="close" size={15}/></button></div><p>Para que EMPRE analice o actúe sobre otra plataforma primero debe existir un Connector autorizado.</p><button onClick={() => openModule('Integraciones')}>Ver integraciones <Icon name="arrow" size={14}/></button></div>}
        {profileOpen && <div className="floating-popover profile-popover"><div className="popover-head"><strong>Mi cuenta</strong><button onClick={() => setProfileOpen(false)}><Icon name="close" size={15}/></button></div><p>{displayName} · {roleLabel} · {companyName}</p><button onClick={() => openModule('Configuración')}>Configuración <Icon name="arrow" size={14}/></button><button onClick={onLogout}>Cerrar sesión</button></div>}
      </header>
      <div className="page-content">
        {active !== 'Inicio' ? <ModuleView active={active} chat={chat} setChat={setChat} input={input} setInput={setInput} sendMessage={sendMessage} taskDone={taskDone} setTaskDone={setTaskDone} agentsState={agentsState} setAgentsState={setAgentsState} integrationState={integrationState} setIntegrationState={setIntegrationState} chatPending={chatPending} summary={summary} company={company} billing={billing} planName={planName} usageText={usageText} onPlanChange={onPlanChange} onCheckout={onCheckout} refreshCompany={async () => { const response = await fetch(`${apiBaseUrl}/company/profile`, { headers: authedHeaders() }); if (response.ok) setCompany((await response.json()).company); }} billingReturnMessage={billingReturnMessage} apiBaseUrl={apiBaseUrl} token={token} openModule={openModule} chatSuggestedActions={chatSuggestedActions} setChatSuggestedActions={setChatSuggestedActions} clearChat={clearChat} connection={connection} refreshConnection={refreshConnection} aiStatus={aiStatus}/> : <>
          <section className="hero panel"><div className="hero-copy"><p className="section-kicker">EMPRE.IA · CENTRO DE INTELIGENCIA</p><h1>Hola, <span>{displayName.split(' ')[0] ?? displayName}</span> <span className="wave">👋</span></h1><p className="hero-sub">{companyName} · {planName}. Estoy lista para ayudarte, pero nunca fingiré acceso a una fuente que no esté conectada.</p><div className="quick-actions"><button className={!connection.connected ? 'action-locked' : ''} onClick={() => connection.connected ? sendMessage('Analiza mis ventas de este mes') : openModule('Integraciones')}><Icon name="chart" size={17}/>Analizar ventas</button><button className={!connection.connected ? 'action-locked' : ''} onClick={() => connection.connected ? sendMessage('Crea un informe mensual') : openModule('Integraciones')}><Icon name="file" size={17}/>Preparar informe</button><button onClick={() => sendMessage('Qué tienes conectado')}><Icon name="integrations" size={17}/>Ver conexiones</button><button onClick={() => openModule('Mi empresa')}><Icon name="settings" size={17}/>Mi empresa</button></div><div className="prompt-box"><Icon name="spark"/><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="¿En qué puedo ayudarte hoy?"/><button aria-label="Enviar" onClick={() => sendMessage()}><Icon name="send" size={20}/></button></div><div className="suggestions">{['¿Qué puedes hacer?', '¿Qué tienes conectado?', 'Analiza mis ventas', '¿Qué diferencia a EMPRE?'].map((text) => <button key={text} onClick={() => sendMessage(text)}>{text}</button>)}</div></div><div className="hero-robot"><div className="robot-orbit orbit-one"/><div className="robot-orbit orbit-two"/><div className="robot-glow"/><img src="/empre-robot.png" alt="Robot asistente de EMPRE.IA"/><div className="robot-bubble"><strong>Hola, soy EMPRE.IA</strong><span>Primero verifico qué información y herramientas están disponibles. Después actúo.</span></div></div></section>
          <div className="kpi-grid">{liveKpis.map((kpi) => <article className={`kpi-card ${kpi.tone}`} key={kpi.label}><div className="kpi-head"><div className="kpi-icon"><Icon name={kpi.icon} size={18}/></div><span>{kpi.label}</span></div><strong>{kpi.value}</strong><div className="kpi-meta"><span>{kpi.detail}</span></div></article>)}</div>
          <section className="panel core-identity-panel"><div className="panel-header"><div><span className="section-kicker">EL ADN DE EMPRE.IA</span><h2>Una IA pensada para trabajar dentro de la empresa</h2></div><span className="local-badge">Fundamento del producto</span></div><p className="core-intro">EMPRE no se limita a conversar. Su arquitectura conecta inteligencia con contexto, herramientas, políticas, aprobaciones y evidencia.</p><div className="core-diff-grid">{differentiators.map(([title, description], index) => <article key={title}><span className="core-number">0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
          <section className="dashboard-grid"><div className="panel integrations-panel"><div className="panel-header"><div><span className="section-kicker">CONECTORES</span><h2>Estado real de las conexiones</h2></div><button className="link-button" onClick={() => openModule('Integraciones')}>Ver todas <Icon name="arrow" size={14}/></button></div><div className="integration-list">{(summary?.integrations ?? []).slice(0, 4).map((item) => <button className="integration-row" key={item.id} onClick={() => openModule('Integraciones')}><span className="integration-icon cyan"><Icon name={(item.kind === 'whatsapp' ? 'whatsapp' : item.kind === 'email' ? 'mail' : item.kind === 'storage' ? 'file' : 'database') as IconName} size={18}/></span><span><strong>{item.name}</strong><small>{connection.connected ? externalText : 'No conectado'}</small></span><i className={`state-dot ${connection.connected ? 'green' : 'orange'}`}/><Icon name="arrow" size={15}/></button>)}</div></div><div className="panel activity-panel"><div className="panel-header"><div><span className="section-kicker">ESTADO</span><h2>Operación local</h2></div><span className="local-badge">Sin datos externos</span></div><div className="activity-list"><button className="activity-row" onClick={() => openModule('Mi empresa')}><span className="activity-icon cyan"><Icon name="settings" size={16}/></span><div><strong>{company?.legalSetupCompleted ? 'Datos legales configurados' : 'Datos legales pendientes'}</strong><small>{company?.legalSetupCompleted ? 'Perfil de empresa listo para revisión' : 'Completa el perfil de empresa'}</small></div><Icon name="arrow" size={14}/></button><button className="activity-row" onClick={() => openModule('Planes y facturación')}><span className="activity-icon purple"><Icon name="chart" size={16}/></span><div><strong>Plan {planName}</strong><small>Uso IA: {usageText}</small></div><Icon name="arrow" size={14}/></button><button className="activity-row" onClick={() => openModule('Integraciones')}><span className="activity-icon orange"><Icon name="integrations" size={16}/></span><div><strong>{summary?.integrations.length ?? 0} conectores disponibles</strong><small>Ninguno conectado externamente todavía</small></div><Icon name="arrow" size={14}/></button></div></div></section>
        </>}
        <footer className="footer"><span>EMPRE.IA · Centro de inteligencia empresarial · Modo local</span><span><i className="footer-dot"/> {apiText} · v0.7.0</span></footer>
      </div>
    </main>
    <IntegrationGuide apiBaseUrl={apiBaseUrl} token={token} canPrepare={currentUser?.role === 'owner' || currentUser?.role === 'admin'} openIntegrations={() => openModule('Integraciones')} />
  </div>;
}
