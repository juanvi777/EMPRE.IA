# Próxima fase — Connector Hub

El Connector Hub es universal. Suldery Nails será sólo el primer laboratorio para validar el patrón; no es una dependencia ni un preset del producto.

## Contrato objetivo

```text
Empresa externa
    ↓
Connector
    ↓
EMPRE API
    ↓
AI Core / Agent Orchestrator
    ↓
Policy Engine
    ↓
Tool Runtime
```

Un Connector no debería exponer una base de datos completa. Debe exponer capacidades explícitas, por ejemplo:

```text
clients.list
clients.get
appointments.list
appointments.create
appointments.cancel
system.health
```

Cada herramienta debe tener nombre, versión, esquema de entrada/salida, permisos, riesgo, idempotencia y límites.

## Orden de trabajo

1. Terminar el núcleo local de EMPRE.
2. Construir el runtime de Connectors con un conector de referencia no destructivo.
3. Diseñar autenticación de integración y almacenamiento de secretos.
4. Conectar un primer sistema real mediante el contrato genérico.
5. Validar ese mismo motor con Suldery y una segunda aplicación distinta.
6. Documentar el procedimiento para que una tercera empresa pueda conectarse sin rehacer EMPRE.
