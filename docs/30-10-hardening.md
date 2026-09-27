# EMPRE.IA — 0.4.2 / 30-10 hardening

## Objetivo

Llegar a una base lista para la primera prueba real de integración sin confundir datos locales con datos externos.

## Cambios

- chat conversacional con historial persistente por usuario/empresa;
- kernel local con intenciones y respuestas coherentes;
- bloqueo de solicitudes operativas si no existe Connector verificado;
- instrucciones explícitas dentro del chat para conectar una fuente;
- Connector Hub con almacenamiento cifrado de secretos;
- prueba de health + autenticación + identidad;
- Connector Hub universal;
- herramientas de lectura y acciones con aprobación;
- desacoplamiento de EMPRE respecto de MySQL de la empresa;
- Free con 1 integración de prueba;
- planes Free/Go/Pro/Business;
- checkout Mercado Pago con activación posterior a verificación;
- soporte para consultar medios disponibles de la cuenta;
- retorno desde checkout con consulta de estado;
- bloqueo de compra pagada si faltan datos legales/tributarios básicos;
- mejoras de navegación y estados de conexión.

## Límites

Esta versión sigue necesitando configuración externa antes de pruebas reales:

- credenciales de prueba/producción de Mercado Pago;
- webhook público HTTPS cuando se pruebe online;
- un endpoint/API del sistema externo accesible;
- una cuenta de integración dedicada.

No se considera producción empresarial definitiva hasta completar seguridad de despliegue, privacidad, contratos, observabilidad, recuperación, billing completo y revisión legal/fiscal.
