#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw 'pnpm no está disponible en PATH.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js no está disponible en PATH.'
}

$nodeVersion = (node --version).TrimStart('v')
$parts = $nodeVersion.Split('.')
$major = [int]$parts[0]
$minor = [int]$parts[1]
if (($major -lt 24) -or ($major -eq 24 -and $minor -lt 11)) {
  throw "EMPRE.IA requiere Node.js 24.11 o superior. Encontrado: $nodeVersion"
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Instalando dependencias...' -ForegroundColor Yellow
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'pnpm install falló.' }
}

Write-Host 'Iniciando EMPRE.IA local...' -ForegroundColor Cyan
Write-Host 'API: http://127.0.0.1:3001/health'
Write-Host 'Web: http://localhost:3000'

$root = $PSScriptRoot
Start-Process powershell.exe -ArgumentList @(
  '-NoProfile',
  '-NoExit',
  '-Command',
  "Set-Location -LiteralPath '$root'; pnpm --filter @empre/api dev"
) | Out-Null

Start-Sleep -Seconds 2

Start-Process powershell.exe -ArgumentList @(
  '-NoProfile',
  '-NoExit',
  '-Command',
  "Set-Location -LiteralPath '$root'; `$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:3001'; pnpm --filter @empre/web dev"
) | Out-Null

Start-Sleep -Seconds 2
Start-Process 'http://localhost:3000' | Out-Null

Write-Host 'EMPRE.IA está iniciándose y el navegador se abrirá automáticamente.' -ForegroundColor Green
