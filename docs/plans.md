# EMPRE.IA — Planes comerciales propuestos

> Precios iniciales del producto. Son una propuesta y deben revisarse antes de abrir cobros al público.

| Plan | Mensual COP | Anual COP | IA | Unidades IA / mes | Integraciones |
|---|---:|---:|---|---:|---:|
| Free | $0 | $0 | Básica | 300 | 1 de prueba |
| Go | $59.900 | $599.000 | Básica + automatización simple | 2.500 | 2 |
| Pro | $199.900 | $1.999.000 | Avanzada + agentes supervisados | 15.000 | 10 |
| Business | $599.900 | $5.999.000 | Avanzada + gobierno empresarial | 50.000 | Sin límite predefinido |

## Principio comercial

No se vende sólo “cantidad de mensajes”. La unidad de valor es la capacidad de trabajo de EMPRE, el contexto empresarial, las herramientas y las automatizaciones.

## Estado del backend

El núcleo local prepara:
- catálogo de planes;
- suscripción por tenant;
- límite mensual de unidades de IA;
- registro de consumo;
- simulación local de cambio de plan;
- checkout Mercado Pago cuando existe configuración server-side;
- verificación del pago antes de activar un plan.

El plan Free permite una integración de prueba para comprobar el flujo extremo a extremo sin obligar al cliente a pagar antes de evaluar la conexión.

## Producción

Antes de cobrar a clientes reales faltan:
- validación final de precios;
- configuración fiscal del vendedor;
- términos, privacidad y política de cancelación;
- credenciales de producción;
- webhooks públicos HTTPS;
- control de vencimiento, mora y cancelación;
- medición de coste real por proveedor/modelo;
- pruebas de conciliación.
