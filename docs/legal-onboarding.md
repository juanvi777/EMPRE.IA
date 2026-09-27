# EMPRE.IA — Alta empresarial y datos legales

## Objetivo

El alta empresarial de EMPRE.IA debe distinguir entre:

- nombre comercial;
- tipo de organización;
- registro formal de la empresa;
- identidad legal (razón social/nombre legal);
- NIT y dígito de verificación cuando corresponda;
- situación tributaria declarada.

La información declarada por el cliente **no equivale** por sí sola a una certificación de cumplimiento tributario.

## NIT en Colombia

El MVP realiza una comprobación local del formato y del dígito de verificación del NIT. El estado `locally_validated` no significa que DIAN haya confirmado la existencia o vigencia del registro.

La consulta oficial del RUT/NIT debe hacerse mediante un canal autorizado. La VUE indica que la consulta del estado del RUT verifica los datos ingresados contra bases de datos de la DIAN y que las consultas por NIT usan el número sin dígito de verificación.

## Regla de producto

Nunca convertir una casilla “sí, pago impuestos” en una afirmación automática de cumplimiento. El dato debe tratarse como declaración del cliente y, cuando EMPRE necesite usarlo para facturación o reglas tributarias, deberá existir una configuración fiscal verificable y vigente.

## Pendiente antes de producción

Implementar un flujo oficial de verificación, con autorización del proveedor/servicio correspondiente, almacenamiento mínimo de datos y registro de evidencia. No declarar `officially_verified` sin una respuesta verificable del sistema oficial.
