# Guía de trabajo para EMPRE.IA

## Alcance y fases

EMPRE.IA es una plataforma empresarial multi-tenant y **no** un chatbot con acceso irrestricto. Trabaje en cambios pequeños, verificables y documentados. No avance de fase sin una solicitud explícita.

La Fase 0 sólo contiene arquitectura y estructura. Los directorios vacíos no constituyen servicios implementados.

## Reglas no negociables

- No use credenciales reales ni las incluya en código, pruebas, documentación o registros.
- Todo dato, consulta, evento, memoria, archivo y credencial debe estar ligado a `tenant_id` y validarse en la capa de aplicación y de datos.
- La IA propone; el sistema de políticas decide; el flujo de aprobación autoriza; una herramienta aislada ejecuta. Nunca omita una de estas capas.
- Las acciones sensibles requieren aprobación humana, idempotencia, límites de alcance y auditoría inmutable.
- Valide entradas y salidas de APIs y herramientas con esquemas versionados. No confíe en la salida de un modelo ni en un conector externo.
- No introduzca dependencias o servicios externos sin revisar su documentación oficial, licencia, mantenimiento, modelo de amenaza y coste operativo.
- No ejecute operaciones destructivas ni migre/elimine datos sin aprobación explícita del usuario y un plan de reversión.
- Antes de editar código existente, inspeccione contexto, pruebas y cambios no confirmados. Preserve los cambios ajenos.

## Calidad y verificación

- Use TypeScript estricto para código nuevo y mantenga separadas las capas `domain`, `application` e `infrastructure`.
- Acompañe cada capacidad crítica con pruebas unitarias, de integración y, cuando corresponda, de aislamiento por tenant y autorización.
- Ejecute los controles relevantes tras cada cambio. Investigue fallos en vez de debilitarlos.
- Registre decisiones relevantes en `docs/decisions.md` y mantenga los demás documentos alineados con la implementación.
- Los commits deben ser pequeños, con una intención clara y una base verificable. No reescriba el historial.

## Límites de seguridad de los agentes

- No entregue secretos al modelo ni persista prompts/respuestas sin clasificación y redacción de datos sensibles.
- Una ejecución necesita identidad de solicitante, tenant, correlación, política evaluada, versión de herramienta, permisos efectivos y resultado auditable.
- Los conectores se ejecutan con privilegio mínimo, credenciales por tenant y aislamiento de red cuando sea posible.
- Prohíba por defecto herramientas no registradas, acciones fuera de alcance, escalamiento de privilegios y acceso entre tenants.

Consulte `docs/` antes de tomar decisiones de diseño.
