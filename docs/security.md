# Seguridad

## Postura

Denegar por defecto. La identidad humana o de servicio origina cada solicitud; el agente sólo recibe una delegación limitada. Ninguna salida de IA es una autorización.

## Controles obligatorios

- OIDC/OAuth 2.1 con MFA y sesiones cortas para usuarios; cuentas de servicio con credenciales rotables y alcance mínimo.
- Autorización central antes de cada lectura sensible y cada escritura/ejecución. RLS es una segunda barrera, no el único control.
- Cifrado TLS en tránsito y cifrado gestionado en reposo. Secretos en un gestor dedicado, por tenant, sin logs ni prompts.
- Registro de auditoría append-only con integridad verificable, retención configurable y acceso restringido.
- Validación de esquemas, límites de tamaño/tiempo, rate limits, protección contra SSRF y allowlists de destinos para conectores.
- Separación de ejecución: adaptadores aislados, tokens de corta vida, egress limitado y permisos mínimos.
- Clasificación/redacción de datos antes de enviar contenido a proveedores de IA. Proveedor, modelo, región y retención deben ser configurables por tenant.
- Gestión de vulnerabilidades: versiones fijadas, escaneo de dependencias e imágenes, revisión de secretos y parcheo con SLA.

## Acciones de riesgo

Una acción se clasifica por impacto y reversibilidad. Las de riesgo medio/alto exigen política explícita, vista previa del alcance, aprobación humana registrada y, cuando sea posible, confirmación de resultado. Ejemplos: enviar comunicaciones externas, modificar registros, ejecutar código, cambiar permisos, eliminar datos y exportar información.

Cada ejecución debe incluir: `tenant_id`, actor solicitante, delegación, acción/herramienta/versiones, recurso y alcance, decisión de política, aprobación, idempotency key, correlación, resultado y evidencia redactada.

## Riesgos abiertos

- Inyección de prompt y datos hostiles desde documentos/conectores.
- Confusión de tenant, especialmente en caché, colas, índices vectoriales y telemetría.
- Escalada indirecta mediante herramientas encadenadas.
- Fuga de datos a proveedores de IA o a logs.
- Desfase entre una aprobación y el estado real del recurso.

La Fase 1 convertirá estos controles en amenazas, requisitos verificables y pruebas de aislamiento.
