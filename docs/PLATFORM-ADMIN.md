# Panel único del propietario

URL: `/platform`

El panel no pertenece a ninguna empresa cliente. Usa una identidad de plataforma separada.

Funciones actuales:
- inicio de sesión del propietario;
- listado de empresas;
- plan actual y origen de suscripción;
- asignación manual de Free / Go / Pro / Business;
- nota de asignación;
- auditoría de la asignación en la empresa.

Variables de bootstrap:
- `EMPRE_PLATFORM_ADMIN_NAME`
- `EMPRE_PLATFORM_ADMIN_EMAIL`
- `EMPRE_PLATFORM_ADMIN_PASSWORD`

Las variables sólo se usan para crear el perfil cuando no existe. No se devuelve la contraseña ni se guarda en texto plano.
