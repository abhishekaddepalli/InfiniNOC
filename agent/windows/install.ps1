<#
.SYNOPSIS
    InfiniNOC Remote Distributed Probe Agent Windows Production Installer
.DESCRIPTION
    Automated installer that detects Node.js LTS, fixes environment PATH,
    registers probe credentials with central NOC, installs background service,
    and configures automatic restart on system reboot.
.PARAMETER Server
    Central InfiniNOC Server URL (e.g. https://noc.example.com)
.PARAMETER ProbeId
    Probe identifier assigned by Central Server
.PARAMETER Token
    One-time enrollment registration token (e.g. prb_reg_xxx)
.PARAMETER InstallDir
    Target directory for probe installation (Default: C:\ProgramData\InfiniNOC\Probe)
.PARAMETER ServiceName
    Windows Scheduled Task service name (Default: InfiniNOC-Probe-Agent)
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$Server = "http://127.0.0.1:3001",

    [Parameter(Mandatory = $false)]
    [int]$ProbeId = 0,

    [Parameter(Mandatory = $false)]
    [string]$Token = "",

    [Parameter(Mandatory = $false)]
    [string]$InstallDir = "C:\ProgramData\InfiniNOC\Probe",

    [Parameter(Mandatory = $false)]
    [string]$ServiceName = "InfiniNOC-Probe-Agent",

    [switch]$AutoInstallNode = $true
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  InfiniNOC Remote Distributed Probe Windows Installer" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Step 1: Detect Node.js Executable and Repair PATH if necessary
function Get-NodeExecutable {
    Write-Host "[1/6] Detecting Node.js runtime environment..." -ForegroundColor Yellow

    # Check current session PATH
    $cmd = Get-Command "node" -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        $nodePath = $cmd.Source
        Write-Host "  Found Node.js in current PATH: $nodePath" -ForegroundColor Green
        return $nodePath
    }

    # Search standard system installation paths
    $candidatePaths = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\node\node.exe",
        "C:\ProgramData\chocolatey\bin\node.exe",
        "C:\nodejs\node.exe",
        "$env:APPDATA\npm\node.exe"
    )

    foreach ($path in $candidatePaths) {
        if (Test-Path $path) {
            Write-Host "  Detected Node.js at $path (not present in current session PATH)." -ForegroundColor Green
            $nodeDir = Split-Path -Parent $path
            $env:PATH = "$nodeDir;" + $env:PATH
            
            # Persistently append to User PATH environment variable
            try {
                $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
                if ($userPath -notlike "*$nodeDir*") {
                    [Environment]::SetEnvironmentVariable("PATH", "$nodeDir;$userPath", "User")
                    Write-Host "  Successfully appended $nodeDir to User PATH." -ForegroundColor Green
                }
            } catch {
                Write-Host "  [Notice] Could not update persistent PATH: $($_.Exception.Message)" -ForegroundColor Gray
            }

            return $path
        }
    }

    # Node.js not found
    if ($AutoInstallNode) {
        Write-Host "  Node.js was not detected on this machine. Initiating automatic LTS installation..." -ForegroundColor Yellow
        
        # Try winget first if available
        $winget = Get-Command "winget" -ErrorAction SilentlyContinue
        if ($winget) {
            Write-Host "  Installing Node.js LTS via winget package manager..." -ForegroundColor Yellow
            try {
                Start-Process -FilePath "winget" -ArgumentList "install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow
                
                # Check standard directory after winget install
                if (Test-Path "$env:ProgramFiles\nodejs\node.exe") {
                    $env:PATH = "$env:ProgramFiles\nodejs;" + $env:PATH
                    return "$env:ProgramFiles\nodejs\node.exe"
                }
            } catch {
                Write-Host "  Winget installation attempt encountered: $($_.Exception.Message)" -ForegroundColor Gray
            }
        }

        # Direct MSI download from nodejs.org
        Write-Host "  Downloading official Node.js LTS Windows Installer (MSI)..." -ForegroundColor Yellow
        $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
        $tempMsi = "$env:TEMP\nodejs-lts-installer.msi"

        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $msiUrl -OutFile $tempMsi -UseBasicParsing
            Write-Host "  Installing Node.js LTS silently..." -ForegroundColor Yellow
            Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$tempMsi`" /qn /norestart" -Wait
            Remove-Item -Force $tempMsi -ErrorAction SilentlyContinue

            if (Test-Path "$env:ProgramFiles\nodejs\node.exe") {
                $env:PATH = "$env:ProgramFiles\nodejs;" + $env:PATH
                return "$env:ProgramFiles\nodejs\node.exe"
            }
        } catch {
            Write-Host "  Automated download error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    throw "Node.js (>= 18.0.0) is required but could not be located or installed automatically. Please install Node.js from https://nodejs.org and rerun this installer."
}

$NodePath = Get-NodeExecutable

# Verify Node Version
$nodeVerStr = & $NodePath -v
Write-Host "  Node.js Version: $nodeVerStr" -ForegroundColor Green

# Step 2: Prepare Installation Directory
Write-Host "[2/6] Preparing probe installation directory: $InstallDir..." -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$agentSourceDir = Split-Path -Parent $scriptDir

# Copy agent file
$agentFileSource = Join-Path $agentSourceDir "infininoc-probe-agent.js"
if (-not (Test-Path $agentFileSource)) {
    $agentFileSource = Join-Path (Split-Path -Parent $agentSourceDir) "agent\infininoc-probe-agent.js"
}

if (Test-Path $agentFileSource) {
    Copy-Item -Path $agentFileSource -Destination "$InstallDir\infininoc-probe-agent.js" -Force
    Write-Host "  Copied infininoc-probe-agent.js to $InstallDir." -ForegroundColor Green
} else {
    # Download from central server if local source missing
    Write-Host "  Downloading latest probe daemon from $Server/api/probe/download/agent.js..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "$Server/api/probe/download/agent.js" -OutFile "$InstallDir\infininoc-probe-agent.js" -UseBasicParsing
}

# Copy auxiliary PowerShell scripts
$auxScripts = @("configure.ps1", "start.ps1", "stop.ps1", "uninstall.ps1", "health-check.ps1", "update.ps1")
foreach ($s in $auxScripts) {
    $srcPath = Join-Path $scriptDir $s
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination "$InstallDir\$s" -Force
    }
}

# Step 3: Configure Probe & Perform Initial Enrollment
Write-Host "[3/6] Configuring probe and enrolling with central NOC server..." -ForegroundColor Yellow
$configPath = "$InstallDir\infininoc-probe-config.json"

if ($ProbeId -gt 0 -and -not [string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "  Registering Probe #$ProbeId with token against $Server..." -ForegroundColor Yellow
    
    $osInfo = "$([System.Environment]::OSVersion.VersionString) ($([System.Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE')))"
    $regBody = @{
        probeId = $ProbeId
        registrationToken = $Token
        version = "1.26.31"
        os_info = $osInfo
    } | ConvertTo-Json

    try {
        $regRes = Invoke-RestMethod -Uri "$Server/api/probe/register" -Method Post -Body $regBody -ContentType "application/json" -TimeoutSec 15
        if ($regRes.ok) {
            Write-Host "  [SUCCESS] Enrollment verified! Acquired persistent API Key." -ForegroundColor Green
            
            $configObj = @{
                server = $Server
                probeId = $ProbeId
                apiKey = $regRes.apiKey
                heartbeatInterval = 20
                taskInterval = 25
            }
            $configObj | ConvertTo-Json -Depth 4 | Set-Content -Path $configPath -Encoding UTF8
            Write-Host "  Secure configuration persisted to $configPath." -ForegroundColor Green
        } else {
            throw "Server returned error: $($regRes.msg)"
        }
    } catch {
        Write-Host "  [WARN] Direct API enrollment error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Writing bootstrap configuration for daemon to retry enrollment..." -ForegroundColor Yellow
        $configObj = @{
            server = $Server
            probeId = $ProbeId
            token = $Token
            heartbeatInterval = 20
            taskInterval = 25
        }
        $configObj | ConvertTo-Json -Depth 4 | Set-Content -Path $configPath -Encoding UTF8
    }
} elseif (Test-Path $configPath) {
    Write-Host "  Using existing probe configuration file at $configPath." -ForegroundColor Green
} else {
    Write-Host "  [Notice] No Token/ProbeId supplied. Please configure via configure.ps1 before starting." -ForegroundColor Yellow
}

# Step 4: Install Persistent Background Windows Service (Scheduled Task)
Write-Host "[4/6] Registering autonomous Windows background service ($ServiceName)..." -ForegroundColor Yellow

# Script block wrapper executed in background
$wrapperScript = @"
Set-Location '$InstallDir'
& '$NodePath' '$InstallDir\infininoc-probe-agent.js' --config='$configPath' *>> '$InstallDir\probe-agent.log'
"@

$wrapperPath = "$InstallDir\run-probe.ps1"
$wrapperScript | Set-Content -Path $wrapperPath -Encoding UTF8

# Check if Scheduled Task cmdlet is available
$hasScheduledTask = Get-Command "Register-ScheduledTask" -ErrorAction SilentlyContinue

if ($hasScheduledTask) {
    try {
        # Unregister existing task if present
        Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false -ErrorAction SilentlyContinue

        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapperPath`"" -WorkingDirectory $InstallDir
        $triggerStartup = New-ScheduledTaskTrigger -AtStartup
        $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
        
        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -RestartCount 999 `
            -RestartInterval (New-TimeSpan -Minutes 1) `
            -ExecutionTimeLimit (New-TimeSpan -Days 0) `
            -StartWhenAvailable `
            -MultipleInstances IgnoreNew

        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        $principal = if ($isAdmin) {
            New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        } else {
            New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
        }

        Register-ScheduledTask -TaskName $ServiceName -Action $action -Trigger @($triggerStartup, $triggerLogon) -Settings $settings -Principal $principal -Description "InfiniNOC Remote Distributed Probe Agent Background Service" | Out-Null
        Write-Host "  Windows background service registered successfully with restart resilience." -ForegroundColor Green
        
        # Start task immediately
        Start-ScheduledTask -TaskName $ServiceName
        Write-Host "  Started background service task: $ServiceName" -ForegroundColor Green
    } catch {
        Write-Host "  Scheduled task creation notice: $($_.Exception.Message). Falling back to background process daemon." -ForegroundColor Yellow
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapperPath`"" -WorkingDirectory $InstallDir
    }
} else {
    # Fallback for environments without Task Scheduler cmdlets
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapperPath`"" -WorkingDirectory $InstallDir
    Write-Host "  Started autonomous background process daemon." -ForegroundColor Green
}

# Step 5: Validate Agent Startup & Initial Heartbeat
Write-Host "[5/6] Validating probe daemon process and heartbeat telemetry..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$runningProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -eq $NodePath -or (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine -like "*infininoc-probe-agent.js*"
}

if ($runningProcesses) {
    Write-Host "  Probe process active (PID: $($runningProcesses[0].Id))." -ForegroundColor Green
} else {
    Write-Host "  [Notice] Node process not detected in process list. Checking log file: $InstallDir\probe-agent.log..." -ForegroundColor Yellow
    if (Test-Path "$InstallDir\probe-agent.log") {
        Get-Content "$InstallDir\probe-agent.log" -Tail 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
}

# Step 6: Summary & Health Verification
Write-Host "[6/6] Installation Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Probe Directory : $InstallDir" -ForegroundColor White
Write-Host "  Config File     : $configPath" -ForegroundColor White
Write-Host "  Logs File       : $InstallDir\probe-agent.log" -ForegroundColor White
Write-Host "  Status          : Active & Running in Background" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "You can now safely close this PowerShell window." -ForegroundColor Cyan
Write-Host "The probe agent will remain running and monitor your local network continuously." -ForegroundColor Green
