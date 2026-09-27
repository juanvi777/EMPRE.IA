# EMPRE.IA — Plan de prueba Suldery Nails

Este documento define la primera prueba real del Connector Hub. No requiere acceso directo a MySQL.

## Requisito previo

Suldery debe estar disponible por HTTPS público (por ejemplo, su despliegue de producción) o por una URL local permitida sólo para desarrollo.

El API actual de Suldery expone rutas protegidas y rutas administrativas. Para esta primera prueba, el Connector verifica que la cuenta de integración tenga rol `owner`, porque las rutas administrativas de lectura actuales lo exigen.

Usa una cuenta de integración dedicada. No compartas credenciales por chat ni las guardes en Git.

## Flujo de conexión

1. EMPRE -> Integraciones.
2. Tipo: Suldery Nails.
3. URL base: raíz de la API/sistema, no una página HTML.
4. Autenticación: Login -> token.
5. Correo/usuario y contraseña de la cuenta de integración.
6. EMPRE hace `GET /api/health`.
7. EMPRE hace `POST /api/auth/login`.
8. EMPRE hace `GET /api/me`.
9. EMPRE exige identidad con rol `owner`.
10. Sólo entonces la conexión pasa a `OPERATIVO`.

## Herramientas iniciales

Lectura:
- `clients.list`
- `appointments.list`
- `appointments.slots`
- `portfolio.list`

Escritura controlada:
- `appointments.create`
- `appointments.status.update`
- `clients.status.update`

Las escrituras crean primero una solicitud de aprobación dentro de EMPRE y sólo después de aprobarse se envían a Suldery.

## Matriz de pruebas

### A. Sin conexión

- analizar ventas -> bloqueado;
- consultar clientes -> bloqueado;
- consultar citas -> bloqueado;
- modificar tareas/agentes/automatizaciones -> bloqueado;
- EMPRE debe explicar cómo conectar.

### B. Conexión

- health -> correcto;
- identidad -> correcta;
- estado -> OPERATIVO;
- lectura de clientes -> datos reales;
- lectura de citas -> datos reales;
- portafolio -> datos reales.

### C. Escritura

- crear solicitud de cita -> pendiente de aprobación;
- aprobar -> envío real a Suldery;
- volver a consultar -> comprobar que el registro existe;
- cambiar estado de cita -> aprobación -> verificación;
- cambiar estado de clienta -> aprobación -> verificación.

### D. Fallo

Si Suldery deja de responder o el token deja de ser válido, EMPRE marca el Connector en error y deja de tratarlo como operativo hasta que vuelva a verificarse.

## No probado todavía

Las rutas actuales de Suldery no exponen una herramienta específica de ventas. EMPRE no debe inventar ingresos. Una fase posterior puede añadir `sales.list`, `payments.list`, `services.list` u otras herramientas según el API real de Suldery.


## Prueba final 0.4.2

1. Registrar/iniciar sesión en EMPRE.IA.
2. Sin Connector operativo, comprobar que análisis, clientes, citas y acciones operativas quedan bloqueados; el chat debe explicar la conexión.
3. Abrir Integraciones, elegir Suldery Nails y usar la URL base pública del sistema.
4. Usar una cuenta de integración dedicada con rol `owner`; introducir las credenciales directamente en EMPRE, nunca por chat.
5. Pulsar `Conectar y verificar`.
6. Ejecutar lectura real de clientes, citas, horarios y portafolio.
7. Crear una solicitud de cita, aprobarla y verificar el resultado en Suldery.
8. Invalidar temporalmente la conexión o detener el sistema y comprobar que EMPRE cambia el Connector a `error` y vuelve a bloquear operaciones.
