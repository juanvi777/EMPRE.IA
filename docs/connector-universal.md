# Connector Hub Universal

EMPRE.IA no tiene una integración nativa exclusiva de Suldery. El núcleo usa un Connector genérico para sistemas externos.

## Qué puede conectarse
- Una API REST propia.
- Un backend de una página web.
- Un CRM/ERP.
- Una tienda o sistema de reservas.
- Un SDK/Connector compatible.
- Cualquier aplicación que pueda exponer endpoints autorizados con el contrato de EMPRE.

## Qué necesita el sistema externo
1. URL base accesible.
2. Endpoint de health.
3. Verificación de identidad si usa autenticación.
4. Herramientas declaradas por manifest o configuración.

Una web pública por sí sola no equivale a una API. Si la empresa sólo tiene una interfaz web sin API/Connector/SDK/webhooks operables, hace falta construir un adaptador específico. EMPRE no debe basarse en scraping como mecanismo principal para ejecutar operaciones empresariales.

## Herramientas
Cada herramienta declara:
- nombre lógico, por ejemplo `clients.list`;
- método HTTP;
- ruta relativa;
- si es de sólo lectura;
- descripción opcional.

Las escrituras pasan por permisos y aprobación.

## Suldery
Suldery Nails será únicamente el primer laboratorio real para demostrar que el mismo Connector genérico puede adaptarse a un sistema concreto. No forma parte del núcleo ni aparece como tipo especial de conexión.
