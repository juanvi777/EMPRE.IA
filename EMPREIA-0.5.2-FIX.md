# EMPRE.IA 0.5.2 – Hotfix de chat

Corrige el error de ejecución `setRealAiProvider is not defined` que ocurría al enviar o limpiar un mensaje.

Causa: `Dashboard` utilizaba `setRealAiProvider(...)` pero el estado sólo existía dentro de `ModuleView`.

Solución: `Dashboard` ahora declara su propio estado `realAiProvider`, evitando el `ReferenceError` y permitiendo que el flujo de `/assistant` actualice el proveedor sin romper la interfaz.
