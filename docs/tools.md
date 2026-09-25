# Sistema de herramientas

## Contrato

Una herramienta es una capacidad versionada y registrada. Debe declarar: identificador, versión, esquema de entrada/salida, clasificaciones de datos, efectos, recursos alcanzables, permisos requeridos, nivel de riesgo, idempotencia, timeout, reintentos, límites y estrategia de compensación.

La herramienta no recibe credenciales generales. El runtime obtiene un secreto efímero con alcance de tenant, integración y acción exacta.

## Autorización de una invocación

1. Resolver tenant y actor delegante.
2. Validar entrada contra esquema y limitar alcance.
3. Consultar grant de herramienta, relación de autorización y política contextual.
4. Crear solicitud de aprobación si la matriz de riesgo lo exige.
5. Ejecutar en adaptador aislado usando idempotency key.
6. Validar salida, verificar el efecto cuando aplique y producir evento de auditoría.

## Política de riesgo inicial

| Riesgo | Ejemplos | Comportamiento |
| --- | --- | --- |
| Bajo | consulta interna no sensible | permitir si hay grant y autorización |
| Medio | lectura sensible, cambios reversibles | permitir sólo bajo política; aprobación configurable |
| Alto | comunicación externa, cambios de negocio | aprobación humana obligatoria y verificación |
| Crítico | borrado, permisos, pagos, código en producción | fuera del alcance inicial; requerirá política específica y controles adicionales |

No habrá herramientas reales ni conectores en Fase 0.
