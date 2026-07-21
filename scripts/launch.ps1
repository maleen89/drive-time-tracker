$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Test-ServerReady {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -in 200, 401
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401) {
      return $true
    }
    return $false
  }
}

function Get-ServerStatusCode {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }
    return $null
  }
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
  [System.Windows.Forms.MessageBox]::Show(
    "Node.js/npm was not found. Install Node.js LTS, then try again.",
    "Drive Time Tracker",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  ) | Out-Null
  exit 1
}

if (-not (Test-Path "$ProjectRoot\.env")) {
  [System.Windows.Forms.MessageBox]::Show(
    "Missing .env file. Copy .env.example to .env and add your API keys first.",
    "Drive Time Tracker",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  ) | Out-Null
  exit 1
}

if (-not (Test-ServerReady)) {
  $existingStatus = Get-ServerStatusCode
  if ($existingStatus -eq 500) {
    [System.Windows.Forms.MessageBox]::Show(
      "Port 3000 has an old server returning errors. Close the ""Drive Time Tracker Server"" command window (or end the node process), then run this launcher again.",
      "Drive Time Tracker",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
  }

  & npm run db:push | Out-Null

  Start-Process cmd.exe -ArgumentList @(
    "/k",
    "cd /d `"$ProjectRoot`" && title Drive Time Tracker Server && npm run dev"
  )

  $deadline = (Get-Date).AddMinutes(2)
  while ((Get-Date) -lt $deadline) {
    if (Test-ServerReady) {
      break
    }
    Start-Sleep -Seconds 2
  }

  if (-not (Test-ServerReady)) {
    [System.Windows.Forms.MessageBox]::Show(
      "Server did not start within 2 minutes. Check the server window for errors.",
      "Drive Time Tracker",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
  }
}

Start-Process "http://localhost:3000"
