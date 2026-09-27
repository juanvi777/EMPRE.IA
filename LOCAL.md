# EMPRE.IA — uso local 0.4.2

## Arranque recomendado

La forma más simple es ejecutar `START-LOCAL.ps1` desde PowerShell. Si prefieres hacerlo manualmente:

Terminal 1:

```powershell
cd "C:\proyectos\EMPRE.IA"
pnpm --filter @empre/api dev
```

Terminal 2:

```powershell
cd "C:\proyectos\EMPRE.IA"
$env:NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:3001"
pnpm --filter @empre/web dev
```

Abrir: http://localhost:3000

También se puede usar desde la raíz con `pnpm dev` para iniciar ambos procesos en paralelo.

## Qué funciona localmente

- Dashboard futurista y responsive.
- Registro de empresa y autenticación local.
- Multi-tenant base: cada empresa tiene su propio contexto y datos.
- Sesiones con tokens y caducidad.
- Auditoría de acciones del núcleo.
- Persistencia local en SQLite mediante `node:sqlite`.
- Navegación de módulos, búsqueda y Ctrl+K.
- Chat local conectado al kernel empresarial.
- Identidad, principios y políticas base de EMPRE.IA.
- Catálogo de cuatro planes: Free, Go, Pro y Business.
- Suscripción y consumo de unidades IA por tenant.
- Perfil de IA por empresa.
- Simulador local de cambio de plan.
- Estado real de la API `/health`.

La interfaz mantiene todavía algunos módulos interactivos como demostraciones locales. Las conexiones externas y la ejecución sobre sistemas de terceros no están activadas.

## Qué NO está conectado todavía

- Modelo LLM de producción.
- Facturación y cobro real.
- WhatsApp real.
- ERP/CRM externos.
- Suldery Nails.
- Connectors productivos.
- Acciones autónomas de alto impacto.
- Gestor de secretos productivo.

Suldery Nails se utilizará después como primer laboratorio para validar el Connector Hub universal.

## Arranque con un clic

Desde `C:\proyectos\EMPRE.IA`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\START-LOCAL.ps1
```

Esto abre una ventana para la API y otra para Next.js.


## 0.4.2 — 30/10 hardening
Chat más interactivo, bloqueo honesto de análisis sin fuente, planes visibles, onboarding legal/tributario, separación núcleo local/integraciones y base segura para Mercado Pago. Ver `docs/30-10-hardening.md`, `docs/legal-onboarding.md` y `docs/billing.md`.


## 0.4.2 — chat + UX + quality hardening

El núcleo local 0.4.2 mejora la conversación con respuestas por intención, acciones sugeridas y limpieza del chat; refuerza el mensaje de fuente de datos, corrige el uso duplicado de auditoría y mantiene el checkout de Mercado Pago como preparación server-side.
