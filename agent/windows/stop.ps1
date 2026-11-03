<#
.SYNOPSIS
    Stop InfiniNOC Probe Background Service
#>
[CmdletBinding()]
param (
    [string]$ServiceName = "InfiniNOC-Probe-Agent"
)

$hasScheduledTask = Get-Command "Stop-ScheduledTask" -ErrorAction SilentlyContinue
if ($hasScheduledTask) {
    try {
        Stop-ScheduledTask -TaskName $ServiceName -ErrorAction SilentlyContinue
        Write-Host "Stopped Windows Scheduled Task '$ServiceName'." -ForegroundColor Green
    } catch {
        # Continue to process kill
    }
}

# Stop running Node probe processes
$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*infininoc-probe-agent.js*" }
foreach ($p in $procs) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped probe process (PID: $($p.ProcessId))." -ForegroundColor Yellow
}

Write-Host "InfiniNOC Probe daemon stopped." -ForegroundColor Green
