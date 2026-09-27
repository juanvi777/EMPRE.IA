## 1. Núcleo local real

- Autenticación local y sesiones.
- Multi-tenant base.
- Roles/permisos.
- Auditoría.
- Persistencia SQLite local.
- Dashboard protegido.
- Núcleo de identidad, principios y políticas de EMPRE.IA.
- Catálogo local de 4 planes y control de consumo de IA.
- Perfil de IA por empresa y política base de aprobación.
- Kernel conversacional local orientado a intención y contexto empresarial.

# Hoja de ruta

## Fase 0 — Arquitectura y preparación (actual)

Documentación, límites de seguridad, estructura de monorepo y control verificable de presencia. Sin dependencias, conectores ni servicios operativos.

## Fase 1 — Núcleo seguro mínimo

Crear el esqueleto ejecutable: workspace TypeScript, API mínima de salud, web mínima, configuración validada, PostgreSQL local de desarrollo, migración inicial de tenants/usuarios/membresías, autenticación simulada sólo para pruebas y auditoría básica. Incluye pruebas de aislamiento y CI inicial. No incluye conectores externos ni agentes autónomos.

## Fase 1B — Fundamentos de producto y núcleo inteligente local

Esta es la fase activa: consolidar EMPRE como producto SaaS empresarial antes de conectar terceros. Incluye identidad del producto, catálogo Free/Go/Pro/Business, uso/consumo, políticas, perfil de IA, kernel conversacional local y una interfaz que explique el diferencial sin simular capacidades externas.

No incluye facturación real, modelos LLM de producción, conectores externos ni autonomía irrestricta.

## Fase 2 — Identidad, autorización y auditoría

OIDC real configurable, modelo OpenFGA inicial, RLS aplicado, cuenta de servicio, decisiones de política y flujo de aprobaciones con trazabilidad.

## Fase 3 — Herramientas y procesos controlados

Registro de herramientas, contrato versionado, worker, workflow durable, sandbox/egress y una herramienta interna no destructiva de referencia.

## Fase 4 — Conocimiento empresarial

Ingestión controlada de documentos, clasificación, almacenamiento, búsqueda por tenant, citación y controles de retención.

## Fase 5 — Agentes supervisados

Orquestación con planes estructurados, presupuestos, gates de política/aprobación, evaluación y una capacidad de recomendación sin efectos externos.

## Fases posteriores

Conectores priorizados por negocio, automatizaciones específicas, monitoreo/anomalías, integraciones de mensajería y visión computacional. Cada una requiere diseño, amenaza, pruebas aisladas y aprobación de alcance.
