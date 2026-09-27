# Prueba de adaptador EMPRE.IA -> Suldery Nails (sobre Connector universal)

Objetivo: validar el primer Connector real de EMPRE sin acceso directo a la base de datos de Suldery.

## Antes de conectar

1. EMPRE debe mostrar el núcleo local operativo.
2. Sin Connector, las operaciones de negocio deben quedar bloqueadas.
3. El usuario debe poder abrir `Integraciones` y ver los pasos de conexión.

## Datos de conexión

- URL base: la URL pública HTTPS del sistema/API de Suldery.
- Health: `/api/health`.
- Login: `/api/auth/login`.
- Verificación: `/api/me`.
- Cuenta: una cuenta de integración dedicada con rol `owner`.

El API de Suldery actual protege sus operaciones administrativas con un middleware que exige `owner`.

## Prueba

1. Crear un Connector genérico con nombre definido por la empresa y mapear las herramientas de Suldery.
2. Pulsar `Conectar y verificar`.
3. Verificar health, login e identidad.
4. Confirmar estado `connected`.
5. Ejecutar lectura de clientes, citas, horarios y portafolio.
6. Crear una solicitud de cita.
7. Aprobar y ejecutar.
8. Volver a leer la información y confirmar el resultado.
9. Desactivar el sistema externo o invalidar temporalmente la credencial.
10. Comprobar que EMPRE marca el Connector como `error` y vuelve a bloquear acciones.

## Regla de seguridad

No compartir contraseñas, Access Tokens, secretos de webhook ni claves de cifrado en el chat. Guardarlos sólo en el servidor de EMPRE.
