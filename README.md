# EMPRE.IA

Plataforma de inteligencia artificial empresarial multi-tenant, diseñada para comprender sistemas conectados, recomendar y ejecutar únicamente acciones explícitamente autorizadas y auditables.

## Estado

Fase 1 — núcleo técnico mínimo. Incluye una web y API locales, sin conectores, credenciales, base de datos ni acciones empresariales.

## Requisitos

- Node.js 24 LTS (>= 24.11.0)
- pnpm 12.6.0

## Inicio local

1. Copie `.env.example` a `.env` sólo en su equipo y ajuste valores no sensibles si hace falta.
2. Ejecute `pnpm install --frozen-lockfile`.
3. Ejecute `pnpm dev`.
4. Abra `http://127.0.0.1:3000`; la API responde en `http://127.0.0.1:3001/health`.

## Controles de calidad

`pnpm check` valida codificación UTF-8, formato, lint, tipos y pruebas.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Seguridad](docs/security.md)
- [Multi-tenancy](docs/multi-tenancy.md)
- [Agentes](docs/agents.md)
- [Herramientas](docs/tools.md)
- [Hoja de ruta](docs/roadmap.md)
- [Decisiones](docs/decisions.md)

## Verificación de la Fase 0

En PowerShell: `./scripts/verify-phase0.ps1`
