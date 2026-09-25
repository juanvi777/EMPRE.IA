$ErrorActionPreference = 'Stop'

$requiredFiles = @(
  'AGENTS.md',
  'README.md',
  'pnpm-workspace.yaml',
  'docs/architecture.md',
  'docs/security.md',
  'docs/multi-tenancy.md',
  'docs/agents.md',
  'docs/tools.md',
  'docs/roadmap.md',
  'docs/decisions.md'
)

$requiredDirectories = @('apps', 'services', 'packages', 'infra', 'contracts', 'scripts')
$missing = @($requiredFiles + $requiredDirectories | Where-Object { -not (Test-Path $_) })

if ($missing.Count -gt 0) {
  throw "Fase 0 incompleta. Faltan: $($missing -join ', ')"
}

$forbidden = @('.env', '.env.local') | Where-Object { Test-Path $_ }
if ($forbidden.Count -gt 0) {
  throw "No se permiten archivos de secretos en el repositorio: $($forbidden -join ', ')"
}

Write-Output 'Fase 0 verificada: estructura y documentación requeridas presentes; sin archivos .env locales.'
