EMPRE.IA — ACTUALIZACIÓN UI FUTURISTA

Esta actualización reemplaza la pantalla técnica de Fase 1 por un dashboard visual real construido con Next.js/React.

Incluye:
- Dashboard EMPRE.IA futurista.
- Sidebar y navegación.
- Topbar y búsqueda.
- Robot oficial en `apps/web/public/empre-robot.png`.
- Chat visual local (sin IA real todavía).
- KPI y gráficos.
- Agentes, integraciones, actividad y tareas.
- Modo oscuro/claro.
- Responsive para móvil.
- Estado de la API `/health`.

IMPORTANTE:
No modifica la arquitectura backend ni añade integraciones externas.
Los datos del dashboard son de demostración hasta conectar la base de datos y los agentes.

INSTALACIÓN:
1. Cierra el servidor de Next.js si está activo (Ctrl+C).
2. Extrae este ZIP sobre `C:\proyectos\EMPRE.IA`.
3. Acepta reemplazar los archivos cuando Windows lo solicite.
4. En PowerShell:

cd "C:\proyectos\EMPRE.IA"
$env:NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:3001"
pnpm --filter @empre/web dev

5. Abre:
http://localhost:3000

Si la API también necesita arrancarse:
en otra PowerShell:
cd "C:\proyectos\EMPRE.IA"
pnpm --filter @empre/api dev
