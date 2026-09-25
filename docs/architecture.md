# Arquitectura de EMPRE.IA

## Objetivo y principios

La plataforma integra sistemas empresariales para observar, razonar, recomendar y, sólo con autorización explícita, ejecutar acciones. Se priorizan aislamiento por empresa, trazabilidad, privilegio mínimo, fallos seguros y evolución incremental.

Se adopta un **monorepo modular TypeScript**. Permite compartir contratos tipados, políticas y utilidades entre web, API y workers sin forzar un despliegue monolítico. Los límites de módulo son obligatorios: el dominio no conoce HTTP, SDKs de IA ni infraestructura.

## Arquitectura objetivo inicial

```
Web empresarial ──► API/BFF ──► módulos de dominio ──► PostgreSQL
                         │              │                 │
                         │              ├──► autorización ─┘
                         │              ├──► auditoría (append-only)
                         │              └──► cola / workflows
                         │                                  │
                     OTel Collector ◄── workers ◄── orquestador de agentes
                                                        │
                                      registro/política de herramientas
                                                        │
                                            adaptadores aislados por tenant
```

La API es el punto de entrada de negocio; Next.js no será una vía alternativa para operaciones sensibles. Los workers no reciben privilegios implícitos: revalidan tenant, autorización, aprobación y alcance antes de llamar a un adaptador.

## Tecnologías seleccionadas y justificación

| Área | Elección | Motivo |
| --- | --- | --- |
| Lenguaje y repositorio | TypeScript estricto + pnpm workspaces | Comparte contratos y reduce errores de interfaz sin imponer microservicios prematuros. |
| Frontend | React + Next.js App Router | Aplicación empresarial tipada, rutas y rendering del servidor. La documentación oficial mantiene App Router como sistema de rutas basado en archivos. |
| API | Node.js LTS + Fastify | API HTTP modular, tipada y con validación/serialización por esquema. |
| Datos transaccionales | PostgreSQL | Integridad, transacciones y Row-Level Security (RLS) como defensa adicional para multi-tenancy. |
| Cache y límites | Redis | Cache efímera, rate limiting y coordinación; nunca fuente de verdad ni repositorio de auditoría. |
| Procesos durables | Temporal | Reintentos, pausas para aprobación y recuperación explícita de procesos de larga duración. |
| Autorización fina | OpenFGA, detrás de un puerto de autorización | RBAC inicial con relaciones/atributos para recursos compartidos y delegación futura. |
| Archivos | Almacenamiento S3-compatible | Cifrado, ciclo de vida y separación de prefijos/buckets por tenant; metadatos en PostgreSQL. |
| Observabilidad | OpenTelemetry Collector + backend gestionado/evaluable | Trazas, métricas y logs correlacionables, sin acoplar el código a un proveedor. |
| Despliegue | Contenedores OCI; Kubernetes sólo al necesitar escala operativa | Portabilidad y despliegues repetibles; empezar con un entorno gestionado de contenedores reduce operación temprana. |

Las versiones se fijarán en la Fase 1 tras validar compatibilidad y soporte. No se instalaron dependencias en Fase 0.

Referencias oficiales verificadas: [Next.js App Router](https://nextjs.org/docs/app), [Fastify: validación](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [Temporal](https://docs.temporal.io/), [OpenFGA](https://openfga.dev/docs/learn/rebac) y [OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/logs/).

## Servicios y responsabilidades

1. `apps/web`: interfaz de operadores y administradores. Sólo consume la API; no conserva secretos de conectores.
2. `apps/api`: identidad, contexto de tenant, contratos HTTP, autorización, casos de uso y lectura de auditoría.
3. `services/agent-orchestrator`: planifica ejecuciones acotadas; no ejecuta conectores directamente.
4. `services/worker`: realiza actividades idempotentes y revalida políticas antes de cualquier efecto externo.
5. `services/connector-runtime`: futuro proceso aislado para adaptadores; sus permisos se reducen por herramienta y tenant.
6. `packages/*`: dominio, contratos, clientes de infraestructura y configuración compartida sin lógica de presentación.

## Modelo de datos inicial (conceptual)

Todas las entidades de negocio contienen `id`, `tenant_id`, marcas de tiempo, actor de creación/modificación y, si aplica, `version` para concurrencia.

| Grupo | Entidades iniciales |
| --- | --- |
| Identidad | `tenants`, `users`, `memberships`, `service_accounts`, `sessions` |
| Control | `roles`, `permissions`, `authorization_bindings`, `approval_policies`, `approval_requests` |
| Integración | `integrations`, `connector_instances`, `credential_references`, `tool_definitions`, `tool_grants` |
| Ejecución | `agent_definitions`, `agent_runs`, `tool_invocations`, `workflow_runs`, `idempotency_keys` |
| Conocimiento | `knowledge_sources`, `documents`, `document_versions`, `ingestion_jobs`, `knowledge_chunks` |
| Evidencia | `audit_events`, `security_events`, `outbox_events` |

Los secretos no se almacenan en estas tablas: `credential_references` sólo conserva un identificador opaco de un gestor de secretos y metadatos no sensibles.

## Escala y límites

- Separe el plano de control (usuarios, políticas, configuraciones) del plano de ejecución (workers, conectores, ingestión).
- Use outbox transaccional para publicar eventos sin perder consistencia entre base de datos y cola.
- Diseñe consumidores idempotentes y particione por `tenant_id` cuando el volumen lo requiera.
- Evite particionar físicamente por tenant de forma prematura; permita tenants dedicados para requisitos regulatorios o de volumen.
- Mantenga límites de concurrencia, tiempo, tamaño de payload, coste y número de herramientas por ejecución.
