import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

export interface IntegrationPlan {
  planId: string;
  status: 'ready_for_owner_review' | 'blocked';
  targetUrl: string;
  detectedKind: 'api-or-connector' | 'public-webpage';
  recommendedAuth: Array<'oauth' | 'login' | 'bearer' | 'api_key' | 'none'>;
  discoveryOrder: string[];
  candidateEndpoints: string[];
  requiredOwnerInputs: string[];
  safetyRules: string[];
  nextSteps: string[];
}

function normalizeBaseUrl(value: string): URL {
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('La URL debe usar http:// o https://.');
  if (parsed.username || parsed.password) throw new Error('No incluyas credenciales dentro de la URL.');
  const host = parsed.hostname.toLowerCase();
  const ip = isIP(host);
  const privateNetwork = (ip === 4 && (/^(10\.|127\.)/.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host))) || (ip === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd')));
  const production = process.env.NODE_ENV === 'production';
  if (privateNetwork && production) throw new Error('Por seguridad, producción no acepta redes privadas o localhost.');
  if (parsed.protocol === 'http:' && production) throw new Error('La preparación universal requiere HTTPS en producción.');
  return parsed;
}

export function createIntegrationPlan(input: { url: string; goal?: string }): IntegrationPlan {
  const parsed = normalizeBaseUrl(input.url);
  const base = parsed.toString().replace(/\/$/, '');
  const lowerGoal = String(input.goal ?? '').toLocaleLowerCase('es-CO');
  const endpoints = ['/openapi.json', '/swagger.json', '/api/health', '/health', '/api/me', '/me', '/empre/manifest', '/api/empre/manifest'];
  const detectedKind = lowerGoal.includes('pagina') || lowerGoal.includes('web publica') ? 'public-webpage' : 'api-or-connector';
  const auth: IntegrationPlan['recommendedAuth'] = detectedKind === 'public-webpage' ? ['oauth','login','bearer','api_key'] : ['oauth','bearer','api_key','login','none'];
  return {
    planId: `plan_${randomBytes(8).toString('hex')}`,
    status: 'ready_for_owner_review',
    targetUrl: base,
    detectedKind,
    recommendedAuth: auth,
    discoveryOrder: ['Comprobar HTTPS y seguridad de la URL', 'Buscar un OpenAPI/Swagger', 'Buscar un manifest de EMPRE', 'Comprobar health', 'Comprobar identidad/autenticación', 'Leer capacidades antes de ejecutar'],
    candidateEndpoints: endpoints.map((path) => `${base}${path}`),
    requiredOwnerInputs: ['Qué sistema desea conectar', 'Qué quiere que EMPRE pueda consultar o hacer', 'Método de autenticación', 'Credencial de integración o autorización OAuth, si aplica', 'Permisos mínimos que el dueño autoriza'],
    safetyRules: ['Nunca usar credenciales de una persona si existe una cuenta técnica', 'No acceder directamente a la base de datos si existe una API/Connector', 'Toda escritura requiere política y aprobación', 'La IA no confirma una conexión hasta verificarla realmente', 'Si el descubrimiento no es suficiente, pedir al propietario la documentación del API'],
    nextSteps: ['Revisar el plan', 'Autorizar la preparación del Connector', 'Completar autenticación', 'Probar health + identidad', 'Revisar herramientas descubiertas', 'Activar sólo las capacidades aprobadas'],
  };
}
