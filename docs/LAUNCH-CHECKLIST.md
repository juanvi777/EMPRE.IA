# EMPRE.IA — checklist de lanzamiento inicial

## Código
- Rama de publicación: `main`.
- No publicar secretos.
- Versión objetivo: `0.6.0`.
- El API escucha en `PORT` y en `0.0.0.0` en producción.

## GitHub
Repositorio objetivo: `https://github.com/juanvi777/EMPRE.IA.git`

Antes del push:
- `git status`
- `git diff --check`
- `pnpm check`
- `pnpm build`

No usar `git push --force`.

## Railway API
Railway puede desplegar un servicio desde un repositorio de GitHub. Para este proyecto, el backend se publica en Railway y el frontend en Vercel.

Configuración del servicio API:
- Root: raíz del repositorio.
- Build: `pnpm install --frozen-lockfile && pnpm --filter @empre/api build`
- Start: `pnpm --filter @empre/api start`
- Healthcheck: `/health`
- Node: 24.x

Persistencia inicial:
- Adjuntar Volume a `/data`.
- EMPRE detecta `RAILWAY_VOLUME_MOUNT_PATH` y guarda allí `.data/empreia.sqlite` automáticamente.
- También se puede fijar `EMPRE_DB_PATH=/data/empreia.sqlite`.

Esto es apropiado para la primera instancia. Antes de escalar horizontalmente o ejecutar varias réplicas, migrar la persistencia a PostgreSQL.

Variables del API:
- `NODE_ENV=production`
- `EMPRE_WEB_ORIGINS=https://TU-WEB`
- `EMPRE_PUBLIC_WEB_URL=https://TU-WEB`
- `OPENAI_API_KEY=...`
- `EMPRE_WEB_SEARCH_ENABLED=true`
- `EMPRE_PLATFORM_ADMIN_NAME=...`
- `EMPRE_PLATFORM_ADMIN_EMAIL=...`
- `EMPRE_PLATFORM_ADMIN_PASSWORD=...`
- `MERCADOPAGO_ENVIRONMENT=production`
- `MERCADOPAGO_ACCESS_TOKEN=...`
- `MERCADOPAGO_WEBHOOK_SECRET=...`
- `MERCADOPAGO_PAYMENT_LINK=https://link.mercadopago.com.co/juanvidal`

## Vercel web
- Root directory: `apps/web`
- Framework: Next.js
- Build: `pnpm build`
- Variable: `NEXT_PUBLIC_API_BASE_URL=https://TU-API-RAILWAY`

## Propietario
URL `/platform`.

Se crea una única cuenta de plataforma si `platform_admins` está vacío. Su identidad está separada de las cuentas de las empresas.

El propietario puede asignar manualmente Free, Go, Pro o Business. Una asignación manual queda marcada como `manual` y bloquea cambios directos del plan por parte de la empresa hasta que el propietario vuelva a intervenir.

## Mercado Pago
El Link de Pago puede servir como respaldo manual. Para suscripciones automáticas, EMPRE debe usar una integración de Suscripciones / Checkout adecuada y webhooks verificados.
