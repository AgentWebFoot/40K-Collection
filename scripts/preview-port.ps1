function Get-PreviewPort {
    $previewPort = 5173
    if ($env:PORT) {
        if (-not [int]::TryParse($env:PORT, [ref]$previewPort) -or $previewPort -lt 1 -or $previewPort -gt 65535) {
            throw 'PORT must be a number between 1 and 65535.'
        }
    }
    return $previewPort
}

function Test-PreviewPortInUse([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connection = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $connection.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($connection)
        return $true
    } catch [System.Net.Sockets.SocketException] {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Get-PreviewNpmCommand {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { return $null }
    $candidate = Join-Path (Split-Path -Parent $nodeCommand.Source) 'npm.cmd'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    return if ($npmCommand) { $npmCommand.Source } else { $null }
}
