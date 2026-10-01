# EMPRE.IA 0.7 — Multiagente + preparación de integraciones

## Idea central
EMPRE utiliza un orquestador que dirige cada petición al especialista adecuado: General, Investigación, Ventas, Clientes, Citas, Documentos, Automatización, Sistema, Connector y Seguridad.

## Preparación de integración por solicitud del dueño
El propietario puede abrir el robot flotante **Guía** y elegir **Preparar conexión**. EMPRE recibe una URL y un objetivo, genera un plan de descubrimiento y propone endpoints candidatos. La preparación no otorga acceso por sí sola.

El flujo es:
1. El propietario solicita la integración.
2. EMPRE valida la URL y crea un plan.
3. Se revisan autenticación, capacidades y permisos.
4. El propietario aplica el borrador al formulario de Connector.
5. Se completa la autenticación.
6. Se prueba health + identidad + manifest.
7. Sólo una conexión verificada desbloquea operaciones externas.

## Requisito de un sistema externo
EMPRE no asume que cualquier URL web pública es una API. Para operar datos de un sistema se necesita una API, SDK/Connector o webhook compatible. Si no existe, se debe desarrollar un adaptador específico.

## Seguridad
- Nunca se conceden acciones externas sin una solicitud explícita y permisos.
- Las escrituras siguen sujetas a política y aprobación.
- En producción, los endpoints productivos deben usar HTTPS.
- Las credenciales permanecen del lado del servidor.
