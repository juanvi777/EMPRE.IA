# EMPRE.IA 0.7.0 — Multiagente + Guía de Integración

## Qué añade
- Orquestador y registro de 10 agentes especializados.
- El chat devuelve el agente seleccionado en cada respuesta del núcleo.
- Asistente de preparación de integración por solicitud explícita del propietario/administrador.
- Planificador que valida la URL, propone descubrimiento, autenticación, endpoints candidatos y reglas de seguridad.
- El plan no concede permisos ni activa una conexión automáticamente.
- Botón flotante del robot con etiqueta pequeña `Guía` en la esquina.
- Guía interactiva y enlace al PowerPoint descargable dentro de la propia web.
- El botón `Preparar conexión` aplica el plan al formulario universal del Connector; el propietario aún debe revisar y completar autenticación.

## Archivos importantes
- `apps/api/src/ai/agent-registry.ts`
- `apps/api/src/ai/orchestrator.ts`
- `apps/api/src/ai/agent-types.ts`
- `apps/api/src/application/integration-planner.ts`
- `apps/api/src/interfaces/http/build-app.ts`
- `apps/web/app/integration-guide.tsx`
- `apps/web/app/dashboard.tsx`
- `apps/web/app/styles.css`
- `apps/web/public/guides/EMPREIA-GUIA-INTEGRACION.pptx`

## Regla de seguridad
“Integrarse sola” significa que EMPRE puede descubrir y preparar el trabajo solicitado por el dueño. No significa que pueda obtener credenciales, concederse permisos o activar acciones externas sin autorización.

## Prueba local
```powershell
cd "C:\proyectos\EMPRE.IA"
pnpm install
pnpm dev
```
Abre `http://localhost:3000`, inicia sesión como propietario/administrador y abre el robot `Guía`.
