#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Project = (Get-Location).Path
$PromptFile = Join-Path $Project "EMPREIA-MASTER-PROMPT.txt"
$LogDir = Join-Path $Project ".empreia"
$LogFile = Join-Path $LogDir "one-run.log"

Write-Host "=== EMPRE.IA ONE RUN ===" -ForegroundColor Cyan
Write-Host "Proyecto: $Project"

if (-not (Test-Path (Join-Path $Project ".git"))) {
    throw "No estás dentro de un repositorio Git."
}
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw "Codex no está disponible en PATH."
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm no está disponible en PATH."
}
if (-not (Test-Path $PromptFile)) {
    throw "Falta EMPREIA-MASTER-PROMPT.txt."
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Write-Host "`n[1/5] Ejecutando Codex en una sola ejecución..." -ForegroundColor Yellow
$prompt = Get-Content -Raw -Encoding UTF8 $PromptFile

# --full-auto permite que codex exec escriba archivos; el prompt prohíbe
# operaciones destructivas y force-push.
& codex exec --full-auto $prompt 2>&1 | Tee-Object -FilePath $LogFile

if ($LASTEXITCODE -ne 0) {
    throw "Codex terminó con código $LASTEXITCODE. Revisa .empreia\one-run.log"
}

Write-Host "`n[2/5] Verificando calidad..." -ForegroundColor Yellow
& pnpm check
if ($LASTEXITCODE -ne 0) { throw "pnpm check falló." }

& pnpm build
if ($LASTEXITCODE -ne 0) { throw "pnpm build falló." }

Write-Host "`n[3/5] Comprobaciones Git/secretos..." -ForegroundColor Yellow

$forbidden = Get-ChildItem -Recurse -File -Force `
    -Include ".env",".env.local","*.pem","*.key","*.p12","*.pfx" `
    -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch "\\node_modules\\" -and
        $_.FullName -notmatch "\\.next\\" -and
        $_.FullName -notmatch "\\dist\\"
    }

if ($forbidden) {
    $names = ($forbidden | ForEach-Object { $_.FullName }) -join "`n"
    throw "Se detectaron posibles secretos. NO se hará commit/push:`n$names"
}

git diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check falló." }

Write-Host "`n[4/5] Commit..." -ForegroundColor Yellow

$branch = (git branch --show-current).Trim()
if ($branch -eq "master") {
    git branch -M main
    $branch = "main"
}
elseif ([string]::IsNullOrWhiteSpace($branch)) {
    git switch -c main
    $branch = "main"
}

git status --short

$changes = git status --porcelain
if ([string]::IsNullOrWhiteSpace(($changes | Out-String))) {
    Write-Host "No hay cambios nuevos para commitear." -ForegroundColor DarkYellow
}
else {
    git add -A
    # La referencia visual local y el log de la ejecución no deben entrar al commit.
    git reset -- design-reference.png .empreia 2>$null
    git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw "La comprobación del índice Git falló." }

    git commit -m "feat: build EMPRE.IA futuristic dashboard"
    if ($LASTEXITCODE -ne 0) { throw "El commit falló." }
}

Write-Host "`n[5/5] Push..." -ForegroundColor Yellow

$originUrl = ""
try {
    $originUrl = (git remote get-url origin 2>$null).Trim()
} catch {
    $originUrl = ""
}

if ([string]::IsNullOrWhiteSpace($originUrl)) {
    Write-Host "No existe origin configurado. El commit queda local; no se inventará ninguna URL." -ForegroundColor DarkYellow
}
else {
    Write-Host "Origin: $originUrl"
    git push -u origin main
    if ($LASTEXITCODE -ne 0) {
        throw "git push fue rechazado. NO se hizo force-push."
    }
}

Write-Host "`n=== EMPRE.IA ONE RUN FINALIZADO ===" -ForegroundColor Green
Write-Host "Log: $LogFile"
git log -3 --oneline
git status --short --branch
