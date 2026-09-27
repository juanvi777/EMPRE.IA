# Registro de decisiones arquitectónicas

## ADR-001 — Monorepo modular TypeScript

**Estado:** aceptada — 2026-09-24.

**Decisión:** usar pnpm workspaces con aplicaciones, servicios y paquetes separados, sin implementar aún dependencias.

**Razón:** contratos compartidos y cambios atómicos al comienzo, conservando límites claros para extraer servicios cuando carga, seguridad u operación lo justifiquen.

## ADR-002 — PostgreSQL compartido con RLS para multi-tenancy

**Estado:** aceptada — 2026-09-24.

**Decisión:** `tenant_id` obligatorio y RLS como defensa profunda; permitir modalidad dedicada en el futuro.

**Razón:** reduce complejidad inicial sin renunciar al aislamiento comprobable.

## ADR-003 — IA sin acceso directo a efectos externos

**Estado:** aceptada — 2026-09-24.

**Decisión:** separar razonamiento, política, aprobación, ejecución y auditoría.

**Razón:** una respuesta de modelo no prueba intención, autorización ni seguridad operacional.

## ADR-004 — Workflows durables para procesos con espera

**Estado:** aceptada conceptualmente — 2026-09-24.

**Decisión:** evaluar/adoptar Temporal en Fase 3, no una cola casera, para procesos con reintentos y aprobación humana.

**Razón:** las aprobaciones y acciones empresariales pueden durar horas o días; requieren recuperación y estado explícito.

## ADR-005 — Autorización fina como puerto, OpenFGA candidato

**Estado:** aceptada conceptualmente — 2026-09-24.

**Decisión:** encapsular autorización tras una interfaz de dominio y validar OpenFGA durante Fase 2.

**Razón:** RBAC basta al inicio, pero delegación de agentes y recursos compartidos necesitan relaciones finas sin acoplar todo el dominio a un proveedor.

## ADR-006 — Núcleo de Fase 1 con Fastify, Next.js, Biome y Vitest

**Estado:** aceptada — 2026-09-24.

**Decisión:** usar Node.js 24 LTS, pnpm 12.6.0, TypeScript estricto, Fastify 5, Next.js 16, Biome y Vitest 5.

**Razón:** reduce herramientas solapadas: Biome cubre lint y formato; Vitest cubre pruebas unitarias e integración con `Fastify.inject`. Las versiones se fijan en el lockfile para instalaciones reproducibles. La API se divide desde el inicio en dominio, aplicación, infraestructura e interfaz HTTP.

## ADR-007 — Regla verificable de UTF-8

**Estado:** aceptada — 2026-09-24.

**Decisión:** `.editorconfig` declara UTF-8 y un control de Node valida archivos de texto versionados, incluidos marcadores comunes de texto mal decodificado.

**Razón:** la terminal de Windows puede mostrar UTF-8 mediante una página de códigos incorrecta; el control verifica bytes reales y evita que ese defecto de visualización se convierta en contenido defectuoso.

## ADR-008 — Núcleo de producto antes de conectores externos

**Estado:** aceptada — 2026-09-27.

**Decisión:** terminar primero el núcleo local de EMPRE.IA (identidad, permisos, auditoría, planes, consumo, políticas, perfil de IA y kernel local) antes de integrar Suldery Nails u otro sistema externo.

**Razón:** Suldery será un laboratorio para validar el patrón universal de Connector, no una dependencia del producto. Esto permite demostrar que EMPRE puede conectarse después a distintos sistemas usando el mismo núcleo.

## ADR-009 — Cuatro planes comerciales y consumo medido

**Estado:** propuesta local — 2026-09-27.

**Decisión:** preparar Free, Go, Pro y Business con límites de capacidad y unidades de uso de IA. La facturación real se implementará después.

**Razón:** una plataforma de agentes y herramientas tiene costes variables; medir uso permite separar experiencia de cliente, capacidad y coste operativo sin prometer IA ilimitada de forma irresponsable.

## ADR-010 — Kernel EMPRE independiente del proveedor de modelo

**Estado:** aceptada — 2026-09-27.

**Decisión:** las reglas de identidad, seguridad, contexto, política y auditoría pertenecen al producto EMPRE; el proveedor/modelo LLM se conecta mediante un adaptador posterior.

**Razón:** así el producto no depende arquitectónicamente de un único proveedor y puede evolucionar el motor de IA sin reconstruir la capa empresarial.
