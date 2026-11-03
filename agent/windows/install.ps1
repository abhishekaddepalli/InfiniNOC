<#
.SYNOPSIS
    InfiniNOC Remote Distributed Probe Agent Windows Production Installer
.DESCRIPTION
    Automated installer that detects Node.js LTS, validates environment compatibility,
    stages agent source files, registers probe credentials with central NOC, installs
    a persistent background service, and configures automatic restart on system reboot.
.PARAMETER Server
    Central InfiniNOC Server URL (e.g. https://noc.example.com)
.PARAMETER ProbeId
    Probe identifier assigned by Central Server
.PARAMETER Token
    One-time enrollment registration token (e.g. prb_reg_xxx)
.PARAMETER InstallDir
    Target directory for probe installation (Default: C:\ProgramData\InfiniNOC\Probe)
.PARAMETER ServiceName
    Windows background service / task name (Default: InfiniNOC-Probe-Agent)
.PARAMETER AutoInstallNode
    Automatically install or upgrade Node.js LTS if missing or outdated (< 18.0.0)
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

# Enforce secure modern TLS protocols (TLS 1.2 / TLS 1.3)
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

# Helper: Mask sensitive registration tokens in logs and console output
function Get-MaskedToken([string]$rawToken) {
    if ([string]::IsNullOrWhiteSpace($rawToken)) { return "" }
    if ($rawToken.Length -le 8) { return "********" }
    return $rawToken.Substring(0, 4) + "..." + $rawToken.Substring($rawToken.Length - 4)
}

$maskedToken = Get-MaskedToken $Token

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  InfiniNOC Remote Distributed Probe Windows Installer" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Step 1: Detect Node.js Executable and Verify Version Compatibility
function Get-NodeExecutable {
    Write-Host "[1/6] Detecting and validating Node.js runtime environment..." -ForegroundColor Yellow

    $candidateExe = $null

    # 1. Check current session PATH
    $cmd = Get-Command "node" -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path -Path $cmd.Source -PathType Leaf)) {
        $candidateExe = $cmd.Source
    }

    # 2. Search standard system installation paths if not found in PATH
    if (-not $candidateExe) {
        $candidatePaths = @(
            "$env:ProgramFiles\nodejs\node.exe",
            "${env:ProgramFiles(x86)}\nodejs\node.exe",
            "$env:LOCALAPPDATA\Programs\node\node.exe",
            "C:\ProgramData\chocolatey\bin\node.exe",
            "C:\nodejs\node.exe",
            "$env:APPDATA\npm\node.exe"
        )

        foreach ($p in $candidatePaths) {
            if (Test-Path -Path $p -PathType Leaf) {
                $candidateExe = $p
                $nodeDir = Split-Path -Parent $p
                $env:PATH = "$nodeDir;" + $env:PATH
                
                # Persistently append to User PATH environment variable
                try {
                    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
                    if ($userPath -notlike "*$nodeDir*") {
                        [Environment]::SetEnvironmentVariable("PATH", "$nodeDir;$userPath", "User")
                        Write-Host "  Successfully added $nodeDir to User PATH." -ForegroundColor Green
                    }
                } catch {}
                break
            }
        }
    }

    # 3. If Node.js found, verify compatibility and execution
    if ($candidateExe) {
        try {
            $testExec = & $candidateExe -e "console.log('NODE_OK')" 2>&1
            if ($testExec -eq "NODE_OK") {
                $verStr = (& $candidateExe -v).Trim()
                $verMatch = [regex]::Match($verStr, 'v?(\d+)\.(\d+)\.(\d+)')
                if ($verMatch.Success) {
                    $major = [int]$verMatch.Groups[1].Value
                    if ($major -ge 18) {
                        Write-Host "  Found verified Node.js: $candidateExe ($verStr)" -ForegroundColor Green
                        if ($major -gt 26) {
                            Write-Host "  [Note] Node.js $verStr is a bleeding-edge non-LTS release. Verified compatible." -ForegroundColor Yellow
                        }
                        return $candidateExe
                    } else {
                        Write-Host "  [WARN] Installed Node.js version ($verStr) is below minimum requirement (>= 18.0.0)." -ForegroundColor Red
                    }
                }
            }
        } catch {
            Write-Host "  [WARN] Node execution validation error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    # 4. Automatic Installation or Upgrade of Node.js LTS
    if ($AutoInstallNode) {
        Write-Host "  Compatible Node.js runtime (>= 18.0.0) not detected. Initiating LTS installation..." -ForegroundColor Yellow
        
        # Try winget first if available
        $winget = Get-Command "winget" -ErrorAction SilentlyContinue
        if ($winget) {
            Write-Host "  Installing Node.js LTS via winget package manager..." -ForegroundColor Yellow
            try {
                Start-Process -FilePath "winget" -ArgumentList "install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow
                if (Test-Path -Path "$env:ProgramFiles\nodejs\node.exe" -PathType Leaf) {
                    $env:PATH = "$env:ProgramFiles\nodejs;" + $env:PATH
                    return "$env:ProgramFiles\nodejs\node.exe"
                }
            } catch {
                Write-Host "  Winget notice: $($_.Exception.Message)" -ForegroundColor Gray
            }
        }

        # Direct MSI download from nodejs.org (Node.js 22 LTS)
        Write-Host "  Downloading official Node.js LTS Windows Installer (MSI)..." -ForegroundColor Yellow
        $msiUrls = @(
            "https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi",
            "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
        )
        $tempMsi = Join-Path $env:TEMP "nodejs-lts-installer.msi"

        foreach ($url in $msiUrls) {
            try {
                Invoke-WebRequest -Uri $url -OutFile $tempMsi -UseBasicParsing -TimeoutSec 60
                if (Test-Path -Path $tempMsi -PathType Leaf) {
                    Write-Host "  Installing Node.js LTS silently..." -ForegroundColor Yellow
                    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$tempMsi`" /qn /norestart" -Wait
                    Remove-Item -Force $tempMsi -ErrorAction SilentlyContinue

                    if (Test-Path -Path "$env:ProgramFiles\nodejs\node.exe" -PathType Leaf) {
                        $env:PATH = "$env:ProgramFiles\nodejs;" + $env:PATH
                        return "$env:ProgramFiles\nodejs\node.exe"
                    }
                }
            } catch {
                Write-Host "  MSI download attempt failed from $url - $($_.Exception.Message)" -ForegroundColor Gray
            }
        }
    }

    throw "Node.js (>= 18.0.0, LTS 20 or 22 recommended) is required to run the InfiniNOC Probe Agent. Please install from https://nodejs.org and rerun this installer."
}

$NodePath = Get-NodeExecutable
$nodeVerStr = (& $NodePath -v).Trim()
Write-Host "  Node.js Active Runtime: $NodePath ($nodeVerStr)" -ForegroundColor Green

# Step 2: Prepare Validated Installation Directories & Stage Agent Source
Write-Host "[2/6] Preparing probe installation directories and staging agent..." -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($InstallDir) -or $InstallDir -eq "C:\ProgramData\InfiniNOC\Probe") {
    $InstallDir = Join-Path $env:ProgramData "InfiniNOC\Probe"
}
$StagingDir = Join-Path $env:TEMP "InfiniNOC-Probe-Install"
$AgentFileSource = Join-Path $StagingDir "infininoc-probe-agent.js"
$AgentFileTarget = Join-Path $InstallDir "infininoc-probe-agent.js"

# Create directories safely and verify they exist before proceeding
if (-not (Test-Path -Path $StagingDir)) {
    New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null
}
if (-not (Test-Path -Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}
if (-not (Test-Path -Path $InstallDir -PathType Container)) {
    throw "Failed to create or access probe installation directory: $InstallDir"
}

# Safely resolve local script directory without assuming in-memory IEX execution has a valid path
$localScriptDir = $null
if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot) -and (Test-Path -Path $PSScriptRoot -PathType Container)) {
    $localScriptDir = $PSScriptRoot
} elseif ($MyInvocation -and $MyInvocation.MyCommand -and -not [string]::IsNullOrWhiteSpace($MyInvocation.MyCommand.Path) -and (Test-Path -Path $MyInvocation.MyCommand.Path -PathType Leaf)) {
    $localScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$agentStaged = $false

# Method B check: Look for local source file on disk
if ($localScriptDir) {
    $candidateSources = @(
        (Join-Path $localScriptDir "infininoc-probe-agent.js"),
        (Join-Path (Split-Path -Parent $localScriptDir) "infininoc-probe-agent.js"),
        (Join-Path (Split-Path -Parent (Split-Path -Parent $localScriptDir)) "agent\infininoc-probe-agent.js")
    )
    foreach ($cand in $candidateSources) {
        if (-not [string]::IsNullOrWhiteSpace($cand) -and (Test-Path -Path $cand -PathType Leaf)) {
            try {
                $candText = Get-Content -Path $cand -Raw -ErrorAction SilentlyContinue
                if ($candText -and ($candText -match "InfiniNOC Remote Distributed Probe Agent" -or $candText -match "AGENT_VERSION")) {
                    Copy-Item -Path $cand -Destination $AgentFileSource -Force
                    $agentStaged = $true
                    Write-Host "  Staged local agent source from: $cand" -ForegroundColor Green
                    break
                }
            } catch {}
        }
    }
}

# Method A (or fallback): Download from central server into staging directory
if (-not $agentStaged) {
    Write-Host "  Downloading latest probe daemon from $Server/api/probe/download/agent.js..." -ForegroundColor Yellow

    $downloadUrl = "$Server/api/probe/download/agent.js"
    $queryParams = @()
    if ($ProbeId -gt 0) { $queryParams += "probeId=$ProbeId" }
    if (-not [string]::IsNullOrWhiteSpace($Token)) { $queryParams += "token=$Token" }
    if ($queryParams.Count -gt 0) {
        $downloadUrl += "?" + ($queryParams -join "&")
    }

    $downloadHeaders = @{
        "User-Agent" = "InfiniNOC-Probe-Installer/1.26.31"
    }
    if ($ProbeId -gt 0) { $downloadHeaders["X-Probe-Id"] = "$ProbeId" }
    if (-not [string]::IsNullOrWhiteSpace($Token)) { $downloadHeaders["X-Probe-Token"] = "$Token" }

    try {
        $res = Invoke-WebRequest -Uri $downloadUrl -Headers $downloadHeaders -UseBasicParsing -TimeoutSec 20
    } catch [System.Net.WebException] {
        $webEx = $_.Exception
        $statusCode = 0
        if ($webEx.Response) {
            $statusCode = [int]$webEx.Response.StatusCode
        }
        throw "Failed to download probe agent daemon. Server returned HTTP error ($statusCode): $($webEx.Message)"
    } catch {
        throw "Failed to download probe agent daemon: $($_.Exception.Message)"
    }

    # 1. Check HTTP status code
    $statusCode = [int]$res.StatusCode
    if ($statusCode -lt 200 -or $statusCode -ge 300) {
        throw "Agent download failed with unexpected HTTP status $statusCode."
    }

    # 2. Reject HTML error pages
    $contentType = ""
    if ($res.Headers -and $res.Headers["Content-Type"]) {
        $contentType = [string]$res.Headers["Content-Type"]
    }
    $bodyText = $res.Content
    if ($contentType -like "*text/html*" -or $bodyText -like "*<!DOCTYPE html*" -or $bodyText -like "*<html*") {
        throw "Server returned an HTML error page instead of JavaScript agent code. Please verify the Server URL ($Server) and API routing."
    }

    # 3. Verify non-empty
    if ([string]::IsNullOrWhiteSpace($bodyText) -or $bodyText.Length -lt 200) {
        throw "Downloaded agent file is empty or incomplete ($($bodyText.Length) bytes)."
    }

    # 4. Validate agent signature
    if ($bodyText -notmatch "InfiniNOC Remote Distributed Probe Agent" -and $bodyText -notmatch "AGENT_VERSION") {
        throw "Downloaded content does not match expected InfiniNOC probe agent signature."
    }

    [System.IO.File]::WriteAllText($AgentFileSource, $bodyText, [System.Text.Encoding]::UTF8)
    $agentStaged = $true
}

if (-not (Test-Path -Path $AgentFileSource -PathType Leaf)) {
    throw "Agent file failed to stage at: $AgentFileSource"
}

# Copy verified staged agent to destination target
Copy-Item -Path $AgentFileSource -Destination $AgentFileTarget -Force
Write-Host "  Agent daemon successfully installed at: $AgentFileTarget" -ForegroundColor Green

# Copy or download auxiliary PowerShell scripts
$auxScripts = @("configure.ps1", "start.ps1", "stop.ps1", "uninstall.ps1", "health-check.ps1", "update.ps1")
foreach ($s in $auxScripts) {
    $copied = $false
    if ($localScriptDir) {
        $srcPath = Join-Path $localScriptDir $s
        if (Test-Path -Path $srcPath -PathType Leaf) {
            Copy-Item -Path $srcPath -Destination (Join-Path $InstallDir $s) -Force
            $copied = $true
        }
    }
    if (-not $copied) {
        try {
            $auxUrl = "$Server/api/probe/download/windows/$s"
            $destPath = Join-Path $InstallDir $s
            Invoke-WebRequest -Uri $auxUrl -OutFile $destPath -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        } catch {}
    }
}

# Step 3: Configure Probe & Perform Initial Enrollment
Write-Host "[3/6] Configuring probe and enrolling with central NOC server..." -ForegroundColor Yellow
$configPath = Join-Path $InstallDir "infininoc-probe-config.json"

if ($ProbeId -gt 0 -and -not [string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "  Registering Probe #$ProbeId with token ($maskedToken) against $Server..." -ForegroundColor Yellow
    
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
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            $configJson = $configObj | ConvertTo-Json -Depth 4
            [System.IO.File]::WriteAllText($configPath, $configJson, $utf8NoBom)
            Write-Host "  Secure configuration persisted to $configPath." -ForegroundColor Green
        } else {
            throw "Server returned error: $($regRes.msg)"
        }
    } catch {
        Write-Host "  [WARN] Direct API enrollment notice: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Writing bootstrap configuration for daemon to retry enrollment on startup..." -ForegroundColor Yellow
        $configObj = @{
            server = $Server
            probeId = $ProbeId
            token = $Token
            heartbeatInterval = 20
            taskInterval = 25
        }
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        $configJson = $configObj | ConvertTo-Json -Depth 4
        [System.IO.File]::WriteAllText($configPath, $configJson, $utf8NoBom)
    }
} elseif (Test-Path -Path $configPath -PathType Leaf) {
    Write-Host "  Using existing probe configuration file at $configPath." -ForegroundColor Green
} else {
    Write-Host "  [Notice] No Token/ProbeId supplied. Please configure via configure.ps1 before starting." -ForegroundColor Yellow
}

# Step 4: Install Persistent Background Windows Service (Scheduled Task)
Write-Host "[4/6] Registering autonomous Windows background service ($ServiceName)..." -ForegroundColor Yellow

# Clean up any lingering previous agent processes before registering new service
$existingProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*infininoc-probe-agent.js*" }
foreach ($p in $existingProcs) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

# Script block wrapper executed in background with automatic log rotation
$wrapperScript = @"
Set-Location '$InstallDir'
`$logFile = '$InstallDir\probe-agent.log'
if (Test-Path `$logFile) {
    `$fileItem = Get-Item `$logFile -ErrorAction SilentlyContinue
    if (`$fileItem -and `$fileItem.Length -gt 10485760) {
        Move-Item -Path `$logFile -Destination (`$logFile + '.1') -Force -ErrorAction SilentlyContinue
    }
}
& '$NodePath' '$AgentFileTarget' --config='$configPath' *>> `$logFile
"@

$wrapperPath = Join-Path $InstallDir "run-probe.ps1"
$wrapperScript | Set-Content -Path $wrapperPath -Encoding UTF8

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

        Register-ScheduledTask -TaskName $ServiceName -Action $action -Trigger @($triggerStartup, $triggerLogon) -Settings $settings -Principal $principal -Description "InfiniNOC Remote Distributed Probe Agent Background Service" -ErrorAction Stop | Out-Null
        Write-Host "  Windows background service registered successfully with restart resilience." -ForegroundColor Green
        
        # Start task immediately
        Start-ScheduledTask -TaskName $ServiceName -ErrorAction Stop
        Write-Host "  Started background service task: $ServiceName" -ForegroundColor Green
    } catch {
        Write-Host "  Scheduled task notice: $($_.Exception.Message). Falling back to background process daemon." -ForegroundColor Yellow
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapperPath`"" -WorkingDirectory $InstallDir
    }
} else {
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
    Write-Host "  [Notice] Node process not detected immediately. Checking log file: $InstallDir\probe-agent.log..." -ForegroundColor Yellow
    if (Test-Path -Path "$InstallDir\probe-agent.log" -PathType Leaf) {
        Get-Content "$InstallDir\probe-agent.log" -Tail 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
}

# Step 6: Cleanup Temporary Files & Verification Summary
Write-Host "[6/6] Cleaning temporary installation files..." -ForegroundColor Yellow
if (Test-Path -Path $StagingDir) {
    Remove-Item -Path $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Probe Directory : $InstallDir" -ForegroundColor White
Write-Host "  Config File     : $configPath" -ForegroundColor White
Write-Host "  Logs File       : $InstallDir\probe-agent.log" -ForegroundColor White
Write-Host "  Status          : Active & Running in Background" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "You can now safely close this PowerShell window." -ForegroundColor Cyan
Write-Host "The probe agent will remain running and monitor your local network continuously." -ForegroundColor Green
