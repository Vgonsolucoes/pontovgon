#requires -Version 5.1
<#
.SYNOPSIS
  Build completo do instalador Windows do VGON PONTO Agent.

.DESCRIPTION
  Pipeline (execute na raiz do repo ou em agent/):
    1. npm ci + npm run build (TypeScript -> dist/)
    2. Monta staging/: runtime (node.exe oficial), app (dist + deps de producao), service (WinSW)
    3. Verifica SHA-256 do node.exe contra o SHASUMS256.txt oficial do nodejs.org
    4. Gera checksums SHA-256 de todos os artefatos do staging
    5. Compila o instalador com ISCC (Inno Setup 6)
    6. Gera installer/Output/SHA256SUMS.txt e public/downloads/agent-manifest.json

  PRE-REQUISITOS:
    - Node.js 20+ e npm no PATH
    - Inno Setup 6 instalado (https://jrsoftware.org/isdl.php)
    - Internet (download do runtime Node e do WinSW)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File agent/installer/build-installer.ps1
.EXAMPLE
  cd agent; npm run installer
#>
[CmdletBinding()]
param(
  [string]$NodeVersion = "20.18.0",
  [string]$WinSwVersion = "v2.12.0",
  [string]$IsccPath = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  [switch]$SkipInno
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$InstallerDir = $PSScriptRoot
$AgentDir     = Split-Path $InstallerDir -Parent
$RepoRoot     = Split-Path $AgentDir -Parent
$StagingDir   = Join-Path $InstallerDir "staging"
$OutputDir    = Join-Path $InstallerDir "Output"
$ManifestDest = Join-Path $RepoRoot "public\downloads"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Assert-Cmd($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Comando '$name' nao encontrado. $hint"
  }
}

# ------------------------------------------------------------------ 1) build
Step "1/7 - Compilando o Agent (npm ci + tsc)"
Assert-Cmd node "Instale o Node.js 20+: https://nodejs.org/"
Assert-Cmd npm  "Instale o Node.js 20+: https://nodejs.org/"
Push-Location $AgentDir
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci falhou (exit $LASTEXITCODE)" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "tsc build falhou (exit $LASTEXITCODE)" }
} finally { Pop-Location }

$pkg = Get-Content (Join-Path $AgentDir "package.json") -Raw | ConvertFrom-Json
$Version = $pkg.version
Write-Host "    Versao do Agent: $Version"

# ---------------------------------------------------------------- 2) staging
Step "2/7 - Montando staging/"
if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$StagingDir\runtime", "$StagingDir\app", "$StagingDir\service" | Out-Null

Copy-Item (Join-Path $AgentDir "dist") -Destination (Join-Path $StagingDir "app\dist") -Recurse
Copy-Item (Join-Path $AgentDir "package.json") -Destination (Join-Path $StagingDir "app\package.json")
if (Test-Path (Join-Path $AgentDir "package-lock.json")) {
  Copy-Item (Join-Path $AgentDir "package-lock.json") -Destination (Join-Path $StagingDir "app\package-lock.json")
}

Step "3/7 - Instalando dependencias de producao no staging (npm ci --omit=dev)"
Push-Location (Join-Path $StagingDir "app")
try {
  npm ci --omit=dev
  if ($LASTEXITCODE -ne 0) { throw "npm ci --omit=dev falhou (exit $LASTEXITCODE)" }
} finally { Pop-Location }

# ----------------------------------------------------- 4) node.exe + WinSW
Step "4/7 - Baixando runtime Node.js v$NodeVersion (com verificacao SHA-256)"
$nodeZipName = "node-v$NodeVersion-win-x64"
$nodeZipUrl  = "https://nodejs.org/dist/v$NodeVersion/$nodeZipName.zip"
$shasumsUrl  = "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt"
$tmpZip      = Join-Path $env:TEMP "$nodeZipName.zip"
Invoke-WebRequest -Uri $nodeZipUrl -OutFile $tmpZip
$expected = ((Invoke-WebRequest -Uri $shasumsUrl).Content -split "`n" |
  Where-Object { $_ -match "$nodeZipName\.zip$" }) -split "\s+" | Select-Object -First 1
$actual = (Get-FileHash $tmpZip -Algorithm SHA256).Hash.ToLower()
if ($expected -and ($expected.ToLower() -ne $actual)) {
  throw "SHA-256 do runtime Node divergente! esperado=$expected obtido=$actual"
}
Write-Host "    SHA-256 do runtime conferido: $actual"
Expand-Archive $tmpZip -DestinationPath (Join-Path $env:TEMP $nodeZipName) -Force
Copy-Item (Join-Path $env:TEMP "$nodeZipName\$nodeZipName\node.exe") -Destination (Join-Path $StagingDir "runtime\node.exe")
Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:TEMP $nodeZipName) -Recurse -Force -ErrorAction SilentlyContinue

Step "5/7 - Baixando WinSW $WinSwVersion"
$winswUrl  = "https://github.com/winsw/winsw/releases/download/$WinSwVersion/WinSW-x64.exe"
$winswDest = Join-Path $StagingDir "service\VgonPontoAgentService.exe"
Invoke-WebRequest -Uri $winswUrl -OutFile $winswDest
$winswHash = (Get-FileHash $winswDest -Algorithm SHA256).Hash.ToLower()
Write-Host "    WinSW SHA-256: $winswHash"

# ------------------------------------------------------------- 6) checksums
Step "6/7 - Gerando checksums SHA-256 do staging"
$checksumFile = Join-Path $StagingDir "SHA256SUMS-staging.txt"
Get-ChildItem $StagingDir -Recurse -File |
  Where-Object { $_.FullName -ne $checksumFile } |
  ForEach-Object {
    $rel = $_.FullName.Substring($StagingDir.Length + 1)
    "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $rel
  } | Set-Content $checksumFile -Encoding utf8
Copy-Item $checksumFile -Destination (Join-Path $StagingDir "app\SHA256SUMS-staging.txt") -Force

# -------------------------------------------------------------- 7) ISCC
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$setupExe = $null
if (-not $SkipInno) {
  Step "7/7 - Compilando instalador (Inno Setup)"
  if (-not (Test-Path $IsccPath)) {
    $alt = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($alt) { $IsccPath = $alt.Source } else {
      throw "ISCC.exe nao encontrado em '$IsccPath'. Instale o Inno Setup 6 ou passe -IsccPath."
    }
  }
  & $IsccPath (Join-Path $InstallerDir "vgon-ponto-agent.iss")
  if ($LASTEXITCODE -ne 0) { throw "ISCC falhou (exit $LASTEXITCODE)" }
  $setupExe = Get-ChildItem $OutputDir -Filter "VGON-PONTO-Agent-Setup-*.exe" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $setupExe) { throw "Instalador nao encontrado em $OutputDir apos o ISCC" }
} else {
  Write-Host "    -SkipInno informado: instalador nao compilado."
}

# --------------------------------------------------- hash final + manifest
$setupHash = $null; $setupSize = $null; $setupName = $null
if ($setupExe) {
  $setupHash = (Get-FileHash $setupExe.FullName -Algorithm SHA256).Hash.ToLower()
  $setupSize = $setupExe.Length
  $setupName = $setupExe.Name
  @("{0}  {1}" -f $setupHash, $setupName) | Set-Content (Join-Path $OutputDir "SHA256SUMS.txt") -Encoding utf8
}

$manifest = [ordered]@{
  name         = "VGON-PONTO-Agent-Setup"
  version      = $Version
  fileName     = $setupName
  sha256       = $setupHash
  sizeBytes    = $setupSize
  arch         = "windows-x64"
  nodeVersion  = $NodeVersion
  winswVersion = $WinSwVersion
  builtAt      = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}
$manifestPath = Join-Path $OutputDir "agent-manifest.json"
$manifest | ConvertTo-Json | Set-Content $manifestPath -Encoding utf8
if (Test-Path $ManifestDest) {
  Copy-Item $manifestPath -Destination $ManifestDest -Force
  if ($setupExe) { Copy-Item $setupExe.FullName -Destination $ManifestDest -Force }
  Write-Host "`nManifest copiado para public/downloads (pagina VGON PONTO Agent)."
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " BUILD CONCLUIDO — VGON PONTO Agent v$Version" -ForegroundColor Green
if ($setupExe) {
  Write-Host " Instalador: $($setupExe.FullName)"
  Write-Host " SHA-256   : $setupHash"
  Write-Host " Tamanho   : $([math]::Round($setupSize/1MB,1)) MB"
}
Write-Host " Manifest  : $manifestPath"
Write-Host "============================================================`n" -ForegroundColor Green
