# EMPRE.IA — One Run

Este paquete prepara una ejecución única para Codex.

Incluye:
- `EMPREIA-MASTER-PROMPT.txt`: especificación completa.
- `EMPREIA-ONE-RUN.ps1`: ejecuta Codex, verifica `pnpm check`, `pnpm build`, revisa secretos, crea commit y hace push sin `--force`.

Uso:

1. Copia estos archivos a `C:\proyectos\EMPRE.IA`.
2. Cuando tengas cuota de Codex disponible, abre PowerShell en esa carpeta.
3. Ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\EMPREIA-ONE-RUN.ps1
```

El script no inventa un remoto `origin`, no hace force-push y se detiene si encuentra posibles secretos o si las verificaciones fallan.
