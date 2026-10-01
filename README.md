# EMPRE.IA

Plataforma de inteligencia y operación empresarial.

> **Tu empresa, más inteligente.**

EMPRE.IA se está construyendo como una capa empresarial que combina IA, contexto autorizado, herramientas, políticas, aprobaciones, memoria y conectores. La interfaz de chat es sólo una puerta de entrada; el objetivo es convertir solicitudes en trabajo empresarial verificable.

## Estado actual

Versión local `0.4.3`: identidad, multi-tenancy base, roles/permisos, auditoría, persistencia SQLite, núcleo conversacional local, políticas, perfil de IA, catálogo Free/Go/Pro/Business y control local de consumo.

Consulta `LOCAL-MVP-REAL.md` y `docs/30-10-hardening.md` para conocer exactamente qué está implementado y qué todavía no.

## Documentación clave

- `docs/empre-core.md` — identidad, principios y comportamiento base.
- `docs/why-empre.md` — por qué EMPRE existe y qué diferencia busca construir.
- `docs/plans.md` — propuesta comercial inicial.
- `docs/connector-handoff.md` — diseño de la futura integración universal.
- `docs/architecture.md` — arquitectura objetivo.
- `docs/security.md` — controles de seguridad.
- `docs/roadmap.md` — hoja de ruta.

## Inicio local

```powershell
pnpm install
pnpm dev
```

Web: `http://localhost:3000`
API: `http://127.0.0.1:3001/health`

La base local se guarda en `.data/empreia.sqlite` y está excluida de Git.


## 0.4.3 — 30/10 hardening
Chat más interactivo, bloqueo honesto de análisis sin fuente, planes visibles, onboarding legal/tributario, separación núcleo local/integraciones y base segura para Mercado Pago. Ver `docs/30-10-hardening.md`, `docs/legal-onboarding.md` y `docs/billing.md`.


## 0.4.3 — chat + UX + quality hardening

El núcleo local 0.4.3 mejora la conversación con respuestas por intención, acciones sugeridas y limpieza del chat; refuerza el mensaje de fuente de datos, corrige el uso duplicado de auditoría y mantiene el checkout de Mercado Pago como preparación server-side.


### IA real e Internet
Para activar la conversación real y la investigación web, configura `OPENAI_API_KEY` únicamente en el backend. La integración usa la Responses API y la herramienta `web_search`; EMPRE decide cuándo buscar y muestra las fuentes devueltas. `EMPRE_WEB_SEARCH_ENABLED=false` desactiva la búsqueda web. Nunca pongas la API key en `NEXT_PUBLIC_*` ni en el frontend.

### Conectar una empresa
EMPRE usa un Connector universal para APIs REST/JSON. No existe acceso mágico a cualquier página web: el sistema externo debe exponer una API, OAuth, credenciales de integración, un manifest o un adaptador específico. EMPRE valida salud, identidad, capacidades y permisos antes de operar.


## 0.7.0 — web launch foundation

- cuenta única de propietario de plataforma en `/platform`;
- asignación manual de planes por empresa;
- persistencia en Railway Volume compatible con `RAILWAY_VOLUME_MOUNT_PATH`;
- API preparada para `PORT` y `0.0.0.0` en producción;
- guía de despliegue Railway + Vercel.


## 0.7.0 — Multiagente + Guía de integración
EMPRE incorpora un registro de agentes especializados y un asistente de preparación de integraciones por solicitud del propietario. En la esquina aparece el robot flotante **Guía**, con ayuda interactiva y enlace al PowerPoint `apps/web/public/guides/EMPREIA-GUIA-INTEGRACION.pptx`.
