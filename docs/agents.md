# Sistema de agentes

## Principio

Un agente es un componente de razonamiento limitado, no una identidad soberana ni un proceso autónomo sin fin. Su salida es un plan estructurado y validado; los efectos externos sólo se producen a través del sistema de herramientas.

## Componentes

- **Definición de agente:** propósito, versión, instrucciones revisadas, modelos permitidos, presupuesto y herramientas candidatas por tenant.
- **Orquestador:** crea una ejecución con contexto mínimo, límites y trazabilidad; no posee credenciales de conectores.
- **Planificador/model gateway:** llama al modelo elegido bajo políticas de datos, usa salida estructurada y conserva metadatos de versión/coste.
- **Policy gate:** autoriza cada paso con la identidad humana delegante y las reglas del tenant.
- **Approval gate:** suspende el workflow si la acción requiere revisión humana.
- **Executor:** invoca una herramienta registrada, idempotente y aislada; verifica el resultado.
- **Memoria/conocimiento:** recupera sólo fuentes autorizadas del mismo tenant, con citas y clasificación.

## Ciclo de una ejecución

`solicitud → contexto y autorización → plan validado → política → [aprobación] → herramienta → verificación → auditoría → resultado`

Límites iniciales: máximo de pasos, tiempo, tokens/coste, llamadas, tamaño de contexto, concurrencia por tenant y lista de herramientas. Se interrumpe y escala a una persona ante ambigüedad de alcance, denegación de política, fallo repetido o impacto alto.

Los agentes autónomos, planificación abierta y memoria persistente operativa quedan fuera de Fase 0.
