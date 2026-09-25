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
