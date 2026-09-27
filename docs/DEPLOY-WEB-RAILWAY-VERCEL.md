# EMPRE.IA — despliegue web (Railway + Vercel)

## Arquitectura
- Vercel: Next.js (`apps/web`).
- Railway: API Fastify (`apps/api`).
- Railway Volume: persistencia inicial de `.data/empreia.sqlite`.

> Esta versión conserva SQLite para no romper el núcleo local. Para escalar a varias réplicas o múltiples nodos, la siguiente evolución debe migrar la persistencia a PostgreSQL.

## Railway (API)
1. Conecta el repositorio `juanvi777/EMPRE.IA` a un servicio Railway.
2. Usa Node 24.x.
3. Build: `pnpm install --frozen-lockfile && pnpm --filter @empre/api build`.
4. Start: `pnpm --filter @empre/api start`.
5. Healthcheck: `/health`.
6. Añade un Volume con mount path `/data`.
7. Variables mínimas:
   - `NODE_ENV=production`
   - `EMPRE_DB_PATH=/data/empreia.sqlite`
   - `EMPRE_WEB_ORIGINS=https://TU-DOMINIO-WEB`
   - `EMPRE_PUBLIC_WEB_URL=https://TU-DOMINIO-WEB`
   - `EMPRE_PLATFORM_ADMIN_EMAIL=...`
   - `EMPRE_PLATFORM_ADMIN_PASSWORD=...`
   - `EMPRE_PLATFORM_ADMIN_NAME=...`
   - `OPENAI_API_KEY=...`
   - `EMPRE_WEB_SEARCH_ENABLED=true`

Railway proporciona `PORT`; EMPRE 0.6.0 ya usa `PORT` si no existe `API_PORT` y escucha en `0.0.0.0` en producción.

## Vercel (web)
1. Conecta el mismo repositorio.
2. Root Directory: `apps/web`.
3. Framework: Next.js.
4. Install Command: `pnpm install`.
5. Build Command: `pnpm build`.
6. Variable `NEXT_PUBLIC_API_BASE_URL=https://TU-DOMINIO-API`.

## Propietario EMPRE.IA
La cuenta de plataforma es única (`platform_admins.id = primary`). Se crea sólo si la tabla está vacía y existen las tres variables del propietario. Después se trabaja con la contraseña hasheada guardada en la base de datos.

Entrar en `/platform` permite listar empresas y asignar manualmente Free, Go, Pro o Business.

Las asignaciones manuales quedan marcadas como `subscription_source=manual` y no pueden ser sustituidas por el cambio manual de plan del propio cliente.

## Seguridad
- No pongas `OPENAI_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN` ni la contraseña del propietario en el frontend.
- Activa HTTPS en producción.
- No uses un Volume como solución multi-réplica a largo plazo; migra a PostgreSQL antes de escalar horizontalmente.
