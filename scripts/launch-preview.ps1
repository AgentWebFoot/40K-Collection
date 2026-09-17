param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$previewRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'preview-port.ps1')
Push-Location -LiteralPath $previewRoot
try {
    # Check the same runtime and local source requirements without reinstalling.
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'install-preview.ps1') -CheckOnly
    if ($LASTEXITCODE -ne 0) { throw 'Preview prerequisites are missing. See the message above.' }
    $npmCommand = Get-PreviewNpmCommand
    if (-not $npmCommand) { throw 'Install Node.js 20 or newer (including npm), then reopen your terminal.' }
    foreach ($dependency in @('react', 'react-dom', 'react-router-dom', 'esbuild', 'tsx')) {
        if (-not (Test-Path -LiteralPath "node_modules/$dependency/package.json")) {
            throw 'Preview dependencies are missing. Run scripts/install-preview.ps1 first.'
        }
    }
    if ($CheckOnly) {
        Write-Host 'Launch prerequisites are ready.'
    } else {
        $previewPort = Get-PreviewPort
        if (Test-PreviewPortInUse $previewPort) {
            throw "Port $previewPort is already in use. If the preview is running, open http://127.0.0.1:$previewPort instead. To restart it, press Ctrl+C in its existing terminal first."
        }
        Write-Host 'Starting the collection preview. Open the URL printed by the server and choose a project.'
        Write-Host 'Keep this terminal open; press Ctrl+C to stop. Restart after editing JSX.'
        & $npmCommand run dev
        if ($LASTEXITCODE -ne 0) { throw "Preview server stopped with exit code $LASTEXITCODE." }
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    Pop-Location
}
