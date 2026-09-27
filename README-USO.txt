# EMPRE.IA — 0.4.0 / 30-10

Este paquete deja a EMPRE.IA lista para la primera prueba real de Connector con Suldery Nails y prepara facturación con Mercado Pago.

## Instalación

1. Haz copia de `C:\proyectos\EMPRE.IA`.
2. Detén `pnpm dev`.
3. Extrae este ZIP encima de `C:\proyectos\EMPRE.IA`.
4. No borres `.data\empreia.sqlite`.
5. Ejecuta:

```powershell
cd "C:\proyectos\EMPRE.IA"
pnpm install
pnpm dev
```

6. Abre `http://localhost:3000`.

## Prueba sin conexión

Entra a:
- Chat con IA
- Análisis
- Clientes
- Automatizaciones
- Agentes
- Tareas

Las operaciones de negocio deben permanecer bloqueadas mientras no exista un Connector verificado.

En el chat prueba:

```text
Hola, ¿cómo estás?
¿Qué puedes hacer?
¿Qué tienes conectado?
Analiza mis ventas de este mes
¿Cómo conecto mi sistema?
```

La solicitud de ventas debe explicar la falta de una fuente real; EMPRE no inventará cifras.

## Primera conexión Suldery

Ve a `Integraciones` y usa:
- Tipo: `Suldery Nails`
- URL base: la URL raíz del servidor/API de Suldery
- autenticación: `Login -> token`
- cuenta: dedicada a la integración

EMPRE comprobará `/api/health`, `/api/auth/login` y `/api/me`. La cuenta debe ser `owner` en la versión actual de Suldery porque sus rutas administrativas están protegidas por ese rol.

Después pulsa `Actualizar lectura real`.

## Pagos Mercado Pago

Para pruebas reales configura en el backend:

```env
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
EMPRE_PUBLIC_WEB_URL=https://tu-dominio-publico.com
MERCADOPAGO_PAYMENT_LINK=https://link.mercadopago.com.co/juanvidal
MERCADOPAGO_ENVIRONMENT=test
```

El Link es un respaldo manual. La integración de EMPRE usa el checkout de Mercado Pago y sólo cambia el plan después de verificar el estado del pago.

Antes de pasar a producción usa credenciales y cuentas de prueba de Mercado Pago.

## Seguridad

Nunca envíes Access Tokens, contraseñas de integración o secretos por el chat.
