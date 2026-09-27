# EMPRE.IA — objetivo 30/10

“30/10” significa que esta entrega debe elevar el núcleo por encima de una simple maqueta: **producto + reglas + datos + seguridad base + identidad + camino comercial**.

## Núcleo enseñado

- Identidad y propósito del producto.
- Principios de no invención, tenant-first, privilegio mínimo, aprobación y auditoría.
- Política base allow / approval / deny.
- Kernel local con clasificación de intención.
- Contexto empresarial local para responder sin inventar acceso externo.
- Separación entre núcleo empresarial y proveedor de IA.

## Producto enseñado

- Empresa y usuario.
- Roles y permisos.
- Sesión.
- Dashboard.
- Auditoría.
- Planes Free / Go / Pro / Business.
- Consumo medido.
- Perfil de IA por empresa.
- Simulación de cambio de plan.

## Diferencial enseñado

EMPRE.IA se orienta a **operar con inteligencia dentro de sistemas empresariales**: conversación, contexto, herramientas, connectors, políticas, aprobación, memoria y evidencia. No se basa en afirmar que un modelo sea “mejor” que otro.

## Lo que falta para poder llamarlo plataforma productiva

- Proveedor LLM real y capa de evaluación.
- Tool runtime seguro.
- Connector Hub productivo.
- Gestor de secretos.
- OAuth/OIDC/MFA.
- PostgreSQL + RLS en producción.
- Workflow durable.
- Ingesta y búsqueda documental.
- Facturación real.
- Observabilidad productiva.
- Pruebas de carga, aislamiento y seguridad.
- Primera integración externa: Suldery Nails como laboratorio.


## 0.4.3 — 30/10 hardening
Chat más interactivo, bloqueo honesto de análisis sin fuente, planes visibles, onboarding legal/tributario, separación núcleo local/integraciones y base segura para Mercado Pago. Ver `docs/30-10-hardening.md`, `docs/legal-onboarding.md` y `docs/billing.md`.


## 0.4.3 — chat + UX + quality hardening

El núcleo local 0.4.3 mejora la conversación con respuestas por intención, acciones sugeridas y limpieza del chat; refuerza el mensaje de fuente de datos, corrige el uso duplicado de auditoría y mantiene el checkout de Mercado Pago como preparación server-side.


## 0.5.0 — IA real + investigación web
- El chat usa OpenAI Responses API cuando OPENAI_API_KEY está configurada.
- La IA puede usar la herramienta `web_search` en Internet en vivo cuando la configuración lo permite.
- Las fuentes URL devueltas por la búsqueda se muestran en el chat.
- La API expone `/ai/status` sin revelar secretos.
- CORS se controla mediante `EMPRE_WEB_ORIGINS` para permitir el dominio real del frontend en producción.
- La ausencia de Connector sigue bloqueando operaciones internas del negocio; la búsqueda web no sustituye el acceso a datos privados de la empresa.
