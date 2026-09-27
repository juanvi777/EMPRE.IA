# EMPRE.IA — Facturación y Mercado Pago

## Modelo

EMPRE.IA separa:

1. catálogo comercial de planes;
2. suscripción de una empresa;
3. proveedor de cobro;
4. estado de pago;
5. permisos de uso y límites de IA.

El proveedor de pago no debe estar expuesto al navegador mediante secretos.

## Mercado Pago

La arquitectura local está preparada para Mercado Pago mediante suscripciones. La API de Mercado Pago permite crear planes con `POST /preapproval_plan` y luego crear suscripciones asociadas con `POST /preapproval`. El checkout/retorno y la gestión posterior deben sincronizarse con el backend. 

Variables de servidor:

```text
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
EMPRE_PUBLIC_WEB_URL=
```

No colocar estas credenciales en `NEXT_PUBLIC_*`, en el repositorio ni en archivos enviados al navegador.

## Webhooks

El endpoint local `POST /billing/mercadopago/webhook` valida la firma HMAC recibida en `x-signature` y `x-request-id` antes de almacenar el evento. El endpoint no activa un plan únicamente por confiar en el payload: el siguiente paso de producción será consultar el recurso oficial en Mercado Pago y verificar el estado de la suscripción/pago.

## Flujo comercial previsto

```text
Empresa selecciona Go/Pro/Business
        ↓
EMPRE crea o reutiliza el plan de suscripción
        ↓
Mercado Pago presenta el checkout
        ↓
Cliente autoriza el cobro
        ↓
Mercado Pago notifica al webhook
        ↓
EMPRE valida firma
        ↓
EMPRE consulta el recurso oficial
        ↓
EMPRE actualiza suscripción y permisos
        ↓
Auditoría
```

## Impuestos

El precio mostrado por EMPRE no debe asumir automáticamente una tarifa tributaria sólo porque una empresa haya declarado estar formalmente registrada. El cálculo final dependerá de la configuración fiscal real del vendedor y de la normativa aplicable al servicio en la fecha del cobro.

Antes de producción, la estructura de precios, IVA, facturación electrónica y responsabilidades deben ser revisadas con el asesor contable/tributario correspondiente.
