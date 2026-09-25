# Multi-tenancy

## Modelo base

Se usa un modelo **compartido con aislamiento lógico fuerte**: una base PostgreSQL compartida, `tenant_id` obligatorio, RLS y un contexto de tenant establecido por transacción. Esto permite empezar con operación sencilla y habilita migrar tenants concretos a recursos dedicados sin cambiar contratos de dominio.

La identidad autenticada determina los tenants disponibles. El cliente nunca elige libremente un `tenant_id`; la API lo resuelve desde membresía, ruta validada y sesión, y lo propaga de forma explícita.

## Reglas de aislamiento

- Cada consulta y mutación filtra por `tenant_id`; RLS aplica una política de default deny.
- Cada mensaje de cola, clave de caché, workflow, objeto, índice de conocimiento y evento incluye el tenant y se valida al consumirlo.
- Los objetos se almacenan con prefijo/bucket por tenant; URLs firmadas son cortas y con alcance mínimo.
- Credenciales, definiciones de herramientas, cuotas, modelos y políticas son propiedad de un tenant.
- La telemetría incluye `tenant_id` sólo cuando sea seguro y con controles de acceso; no expone contenido sensible.

## Defensa en profundidad

1. Autenticación y membresía establecen el contexto.
2. La capa de aplicación verifica autorización del recurso.
3. La base aplica RLS con rol de aplicación sin `BYPASSRLS` y tablas con `FORCE ROW LEVEL SECURITY` donde corresponda.
4. Pruebas automatizadas intentan acceder, modificar y recuperar recursos de otro tenant.

La documentación de PostgreSQL advierte que propietarios de tablas y roles con `BYPASSRLS` pueden omitir RLS; por ello no se usarán para tráfico normal ([referencia](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)).
