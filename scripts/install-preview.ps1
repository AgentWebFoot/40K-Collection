param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$previewRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'preview-port.ps1')
Push-Location -LiteralPath $previewRoot
try {
    $npmCommand = Get-PreviewNpmCommand
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not $npmCommand) {
        throw 'Install Node.js 20 or newer (including npm), then reopen your terminal.'
    }
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) {
        throw 'This preview requires Node.js 20 or newer.'
    }
    foreach ($file in @('package.json', 'preview/server.mjs', 'preview/app.jsx', 'preview/auth.mjs', 'preview/accounts.mjs', 'preview/mock-api.mjs', 'preview/index.html', 'preview/style.css', 'PyrrhicWar/PyrrhicWar.jsx', 'PyrrhicWar/PyrrhicWarMap.jsx', 'PyrrhicWar/PyrrhicWarCompendium.jsx', 'HybridCampaign/HybridCampaign.jsx', 'HybridCampaign/src/features/atlas/AtlasApp.tsx', 'HybridCampaign/server/atlas-preview-host.ts')) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Missing simulator file: $file. Restore it from the repository or use a complete checkout; see README.md."
        }
    }
    foreach ($file in @('preview/expedition-api.mjs', 'Expedition/Expedition.jsx', 'Expedition/ExpeditionMap.jsx', 'Expedition/ExpeditionMap.html', 'Expedition/ExpeditionMap.gif')) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Missing Expedition preview file: $file. Restore it from the repository."
        }
    }
    foreach ($file in @('Expedition/expeditionmap.json', 'Expedition/location-compendium.json', 'PyrrhicWar/campaign-map.json', 'PyrrhicWar/pyrrhicCompendium.JSON')) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            Write-Warning "Optional local data is absent: $file. Its project will use an empty preview fixture."
        }
    }
    if ($CheckOnly) {
        Write-Host 'Install prerequisites are ready.'
    } else {
        $previewPort = Get-PreviewPort
        if (Test-PreviewPortInUse $previewPort) {
            throw "Port $previewPort is in use. Stop the preview with Ctrl+C in its terminal before installing; a running preview can lock esbuild.exe."
        }
        if (Test-Path -LiteralPath 'package-lock.json') {
            & $npmCommand ci
        } else {
            & $npmCommand install
        }
        if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed (exit $LASTEXITCODE). If esbuild.exe is locked, stop any running preview terminals with Ctrl+C, then retry this script." }
        Write-Host 'Installed. Run scripts/launch-preview.ps1 to start the test page.'
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    Pop-Location
}
