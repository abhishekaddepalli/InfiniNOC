<#
.SYNOPSIS
    InfiniNOC Probe Health and Diagnostics Inspector
#>
[CmdletBinding()]
param (
    [string]$InstallDir = "C:\ProgramData\InfiniNOC\Probe",
    [string]$ServiceName = "InfiniNOC-Probe-Agent"
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  InfiniNOC Probe Agent Live Health Diagnostics" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$configPath = "$InstallDir\infininoc-probe-config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "[FAIL] Config file not found at $configPath. Probe is not configured." -ForegroundColor Red
    return
}

$config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
Write-Host "Probe ID        : $($config.probeId)" -ForegroundColor White
Write-Host "Central Server  : $($config.server)" -ForegroundColor White
Write-Host "API Key Status  : $(if ($config.apiKey) { 'Configured (Active)' } else { 'Pending Registration' })" -ForegroundColor White

# Check Windows Scheduled Task status
$hasScheduledTask = Get-Command "Get-ScheduledTask" -ErrorAction SilentlyContinue
if ($hasScheduledTask) {
    $task = Get-ScheduledTask -TaskName $ServiceName -ErrorAction SilentlyContinue
    if ($task) {
        Write-Host "Scheduled Task  : $($task.State)" -ForegroundColor $(if ($task.State -eq 'Running') { 'Green' } else { 'Yellow' })
    }
}

# Check Running Processes
$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*infininoc-probe-agent.js*" }
if ($procs) {
    Write-Host "Process State   : RUNNING (PID: $($procs[0].ProcessId))" -ForegroundColor Green
} else {
    Write-Host "Process State   : STOPPED" -ForegroundColor Red
}

# Test Central Server Reachability
try {
    $start = Get-Date
    $res = Invoke-RestMethod -Uri "$($config.server)/api/probe/tasks?probeId=$($config.probeId)" -Headers @{
        "x-probe-id" = "$($config.probeId)"
        "x-api-key" = "$($config.apiKey)"
    } -TimeoutSec 5 -ErrorAction Stop
    $latency = [Math]::Round(((Get-Date) - $start).TotalMilliseconds)

    Write-Host "NOC Reachability: CONNECTED (${latency} ms)" -ForegroundColor Green
    Write-Host "Assigned Tasks  : $(if ($res.tasks) { $res.tasks.Count } else { 0 }) target(s)" -ForegroundColor Green
} catch {
    Write-Host "NOC Reachability: FAILED ($($_.Exception.Message))" -ForegroundColor Red
}

# Tail recent logs
$logPath = "$InstallDir\probe-agent.log"
if (Test-Path $logPath) {
    Write-Host "`nRecent Agent Telemetry Logs:" -ForegroundColor Cyan
    Get-Content -Path $logPath -Tail 5 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Gray
    }
}
Write-Host "============================================================" -ForegroundColor Cyan
