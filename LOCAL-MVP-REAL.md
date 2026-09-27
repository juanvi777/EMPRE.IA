# EMPRE.IA — núcleo local 0.4.2

Esta versión consolida el MVP local en una dirección de producto SaaS empresarial.

## Ya funciona localmente

- Registro e inicio de sesión.
- Empresa/tenant y rol propietario.
- Sesiones con token almacenado como hash.
- Persistencia en SQLite mediante `node:sqlite`.
- Dashboard protegido.
- Conteos vivos del tenant.
- Tareas, agentes y automatizaciones persistentes en API.
- Auditoría de acciones.
- Núcleo conversacional local orientado por intención y contexto.
- Identidad y principios base de EMPRE.IA.
- Políticas base: lectura, análisis, aprobación y denegación.
- Cuatro planes comerciales de referencia: Free, Go, Pro y Business.
- Control local de unidades de uso de IA.
- Perfil de IA por empresa.
- Simulador local de cambio de plan.

## Todavía no es producción

No hay todavía un modelo LLM productivo, facturación real, conectores externos, WhatsApp real, ejecución autónoma sobre sistemas de terceros, gestor de secretos ni despliegue cloud de producción.

## Qué estamos preparando

El núcleo está diseñado para evolucionar hacia:

```text
EMPRE.IA
  -> AI Core
  -> Agent Orchestrator
  -> Policy / Approval
  -> Tool Runtime
  -> Connector Hub
  -> Sistemas empresariales
```

Suldery Nails será el primer laboratorio de integración después de cerrar este núcleo. No es una dependencia arquitectónica de EMPRE.IA.
