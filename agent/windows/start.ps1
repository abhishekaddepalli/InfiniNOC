<#
.SYNOPSIS
    Start InfiniNOC Probe Background Service
#>
[CmdletBinding()]
param (
    [string]$ServiceName = "InfiniNOC-Probe-Agent",
    [string]$InstallDir = "C:\ProgramData\InfiniNOC\Probe"
)

$hasScheduledTask = Get-Command "Start-ScheduledTask" -ErrorAction SilentlyContinue
if ($hasScheduledTask) {
    try {
        Start-ScheduledTask -TaskName $ServiceName -ErrorAction Stop
        Write-Host "Started Windows Scheduled Task '$ServiceName'." -ForegroundColor Green
        return
    } catch {
        Write-Host "Task start notice: $($_.Exception.Message). Launching background process..." -ForegroundColor Yellow
    }
}

$wrapperPath = "$InstallDir\run-probe.ps1"
if (Test-Path $wrapperPath) {
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapperPath`"" -WorkingDirectory $InstallDir
    Write-Host "Started probe agent process daemon." -ForegroundColor Green
} else {
    Write-Host "Wrapper script not found at $wrapperPath. Please run install.ps1 first." -ForegroundColor Red
}
