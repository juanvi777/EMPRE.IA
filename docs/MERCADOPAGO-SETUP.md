# Mercado Pago para EMPRE.IA

## 1. Lo que tienes ahora

Tu Link de Pago público puede mantenerse como respaldo manual:

```text
https://link.mercadopago.com.co/juanvidal
```

No es el mecanismo principal que debe usar EMPRE para identificar automáticamente qué empresa compró qué plan. Para eso EMPRE usa la integración server-side de Mercado Pago.

## 2. Integración recomendada de EMPRE

EMPRE usa el checkout basado en Orders API:

```text
Empresa cliente
  -> elige plan
  -> EMPRE crea una order
  -> Mercado Pago devuelve checkout_url
  -> cliente paga
  -> Mercado Pago notifica / EMPRE consulta estado
  -> EMPRE activa el plan sólo cuando el pago está confirmado
```

Nunca actives un plan solamente porque el navegador volvió desde el checkout.

## 3. Variables del servidor

```env
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
EMPRE_PUBLIC_WEB_URL=https://tu-dominio.com
MERCADOPAGO_PAYMENT_LINK=https://link.mercadopago.com.co/juanvidal
MERCADOPAGO_ENVIRONMENT=test
```

`MERCADOPAGO_PAYMENT_LINK` es sólo respaldo manual.

El Access Token y el secreto del webhook deben existir únicamente en el backend. No los pongas en Next.js, HTML, JavaScript del navegador, Git ni mensajes públicos.

## 4. Pruebas antes de cobrar dinero real

Mercado Pago recomienda usar una cuenta de prueba vendedor y una cuenta de prueba comprador para validar el flujo completo antes de producción. Las credenciales de prueba se obtienen desde la aplicación en Mercado Pago Developers. 

Primero prueba:

1. crear una order;
2. abrir `checkout_url`;
3. pagar con la cuenta de prueba;
4. consultar `/v1/orders/{id}`;
5. confirmar que EMPRE cambia el plan sólo con una confirmación válida.

## 5. Medios de pago

Mercado Pago publica los medios disponibles para la cuenta mediante `/v1/payment_methods`. En Colombia existe PSE. La documentación de PSE incluye NEQUI dentro de las instituciones financieras mostradas por ese flujo. La disponibilidad exacta debe comprobarse para la cuenta y checkout utilizados.

El Link de Pago que ya tienes puede no mostrar los mismos medios que un checkout integrado; por eso no vamos a diseñar EMPRE alrededor de ese Link.

## 6. Suscripciones

Para una renovación automática mensual/anual, Mercado Pago también dispone de APIs de suscripciones. La disponibilidad de medios puede variar según el tipo de cobro. EMPRE debe diferenciar:

- pago inicial;
- suscripción recurrente;
- renovación;
- pago pendiente;
- cancelación;
- reactivación.

No se debe prometer que todos los medios de pago sirven para cobros recurrentes automáticos.

## 7. Impuestos

La situación tributaria que declara el comprador se guarda separada de la configuración fiscal del vendedor. EMPRE no debe inventar una tasa fiscal universal. La configuración final debe validarse con la normativa aplicable y asesoría contable/fiscal.
