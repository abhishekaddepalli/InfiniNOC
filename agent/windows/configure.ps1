<#
.SYNOPSIS
    InfiniNOC Probe Agent Configuration Utility
#>
[CmdletBinding()]
param (
    [string]$Server,
    [int]$ProbeId,
    [string]$ApiKey,
    [string]$Token,
    [int]$HeartbeatInterval,
    [string]$InstallDir = "C:\ProgramData\InfiniNOC\Probe"
)

$configPath = "$InstallDir\infininoc-probe-config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "Creating new probe config at $configPath..." -ForegroundColor Yellow
    $config = @{}
} else {
    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
}

if ($Server) { $config.server = $Server }
if ($ProbeId) { $config.probeId = $ProbeId }
if ($ApiKey) { $config.apiKey = $ApiKey }
if ($Token) { $config.token = $Token }
if ($HeartbeatInterval) { $config.heartbeatInterval = $HeartbeatInterval }

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$configJson = $config | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($configPath, $configJson, $utf8NoBom)
Write-Host "Configuration updated successfully at $configPath." -ForegroundColor Green
