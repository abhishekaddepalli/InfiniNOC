<#
.SYNOPSIS
    Uninstall InfiniNOC Probe Background Service and Clean Up Files
#>
[CmdletBinding()]
param (
    [string]$ServiceName = "InfiniNOC-Probe-Agent",
    [string]$InstallDir = "C:\ProgramData\InfiniNOC\Probe",
    [switch]$KeepConfig
)

Write-Host "Uninstalling InfiniNOC Remote Distributed Probe..." -ForegroundColor Yellow

# Step 1: Stop running service
$scriptDir = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) { $PSScriptRoot } else { $InstallDir }
$stopScript = Join-Path $scriptDir "stop.ps1"
if (Test-Path -Path $stopScript -PathType Leaf) {
    & $stopScript -ServiceName $ServiceName
}

# Step 2: Unregister Scheduled Task
$hasScheduledTask = Get-Command "Unregister-ScheduledTask" -ErrorAction SilentlyContinue
if ($hasScheduledTask) {
    Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Unregistered scheduled task '$ServiceName'." -ForegroundColor Green
}

# Step 3: Remove installation directory
if (-not $KeepConfig) {
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Removed installation directory: $InstallDir." -ForegroundColor Green
    }
} else {
    Write-Host "Preserved configuration files in: $InstallDir." -ForegroundColor Yellow
}

Write-Host "InfiniNOC Remote Distributed Probe uninstalled successfully." -ForegroundColor Green
