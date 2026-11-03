<#
.SYNOPSIS
    Update InfiniNOC Probe Agent Daemon to Latest Version
#>
[CmdletBinding()]
param (
    [string]$InstallDir = "C:\ProgramData\InfiniNOC\Probe",
    [string]$ServiceName = "InfiniNOC-Probe-Agent"
)

Write-Host "Updating InfiniNOC Probe Agent..." -ForegroundColor Yellow

$configPath = "$InstallDir\infininoc-probe-config.json"
if (-not (Test-Path $configPath)) {
    throw "Configuration file not found at $configPath."
}

$config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
$server = $config.server

$tempAgent = "$env:TEMP\infininoc-probe-agent-new.js"
Write-Host "Downloading latest agent daemon from $server/api/probe/download/agent.js..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$server/api/probe/download/agent.js" -OutFile $tempAgent -UseBasicParsing

# Stop service
& (Join-Path $PSScriptRoot "stop.ps1") -ServiceName $ServiceName

# Replace agent file
Copy-Item -Path $tempAgent -Destination "$InstallDir\infininoc-probe-agent.js" -Force
Remove-Item -Path $tempAgent -Force -ErrorAction SilentlyContinue

# Restart service
& (Join-Path $PSScriptRoot "start.ps1") -ServiceName $ServiceName -InstallDir $InstallDir

Write-Host "Probe agent updated and restarted successfully." -ForegroundColor Green
