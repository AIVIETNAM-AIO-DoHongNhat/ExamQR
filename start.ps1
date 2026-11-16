<#
.SYNOPSIS
  Khoi dong nhanh du an ExamQR.

.EXAMPLE
  .\start.ps1                 # chay dev o cong 3000 (tu cai package / tao .env neu thieu)
  .\start.ps1 -Open           # chay dev va tu mo trinh duyet
  .\start.ps1 -Port 3001      # chon cong khac
  .\start.ps1 -DbPush         # dong bo schema Prisma vao CSDL truoc khi chay
  .\start.ps1 -Install        # ep chay lai npm install
  .\start.ps1 -Prod           # build roi chay ban production (next start)
#>
[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$Open,
    [switch]$DbPush,
    [switch]$Install,
    [switch]$Prod
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Write-Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2([string]$msg){ Write-Host "    $msg" -ForegroundColor Yellow }
function Fail([string]$msg) {
    Write-Host "LOI: $msg" -ForegroundColor Red
    exit 1
}
function Invoke-Native([string]$label, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { Fail "$label that bai (exit code $LASTEXITCODE)." }
}
function Test-PortInUse([int]$p) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $p, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(200)
        return ($ok -and $client.Connected)
    } catch { return $false } finally { $client.Close() }
}
function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}

# ---------------------------------------------------------------- 1. Node
Write-Step 'Kiem tra Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Chua cai Node.js. Tai tai https://nodejs.org (ban LTS >= 18.18).'
}
$nodeVer = (node -v).TrimStart('v')
$parts = $nodeVer.Split('.')
if ([int]$parts[0] -lt 18 -or ([int]$parts[0] -eq 18 -and [int]$parts[1] -lt 18)) {
    Fail "Node $nodeVer qua cu. Next.js 15 can Node >= 18.18."
}
Write-Ok "Node v$nodeVer"

# ---------------------------------------------------------------- 2. .env
Write-Step 'Kiem tra file .env'
$envPath = Join-Path $PSScriptRoot '.env'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $PSScriptRoot '.env.example') $envPath
    Write-Warn2 'Da tao .env tu .env.example.'
}

# Tu sinh 2 chuoi bi mat neu dang de trong.
$lines = [System.IO.File]::ReadAllLines($envPath, $utf8NoBom)
$changed = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '^\s*(PARTICIPANT_TOKEN_SECRET|CRON_SECRET)\s*=\s*("")?\s*$') {
        $lines[$i] = "$($Matches[1])=`"$(New-Secret)`""
        Write-Ok "Da sinh $($Matches[1])"
        $changed = $true
    }
}
if ($changed) { [System.IO.File]::WriteAllLines($envPath, $lines, $utf8NoBom) }

# Bao loi neu bien bat buoc con trong hoac con placeholder.
$required = 'DATABASE_URL', 'DIRECT_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'
$missing = @()
foreach ($key in $required) {
    $line = $lines | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    $val = if ($line) { ($line -replace "^\s*$key\s*=\s*", '').Trim().Trim('"') } else { '' }
    if (-not $val -or $val -match '\[ref\]|\[password\]') { $missing += $key }
}
if ($missing.Count -gt 0) {
    Write-Warn2 "Cac bien sau trong .env chua duoc dien: $($missing -join ', ')"
    Fail 'Mo file .env, dien thong tin Supabase roi chay lai script.'
}
Write-Ok '.env hop le'

# ---------------------------------------------------------------- 3. npm install
Write-Step 'Kiem tra thu vien (node_modules)'
$nm = Join-Path $PSScriptRoot 'node_modules'
$lockInstalled = Join-Path $nm '.package-lock.json'
$lockFile = Join-Path $PSScriptRoot 'package-lock.json'
$needInstall = $Install -or -not (Test-Path $lockInstalled) -or
    ((Test-Path $lockFile) -and (Get-Item $lockFile).LastWriteTime -gt (Get-Item $lockInstalled).LastWriteTime)
if ($needInstall) {
    Write-Warn2 'Dang chay npm install...'
    Invoke-Native 'npm install' { npm install }   # postinstall da tu chay prisma generate
} else {
    Write-Ok 'Da cai day du'
    # Schema doi ma chua generate lai client -> generate.
    $schema = Join-Path $PSScriptRoot 'prisma\schema.prisma'
    $client = Join-Path $nm '.prisma\client\index.js'
    if (-not (Test-Path $client) -or (Get-Item $schema).LastWriteTime -gt (Get-Item $client).LastWriteTime) {
        Write-Warn2 'Schema Prisma thay doi, dang generate lai client...'
        Invoke-Native 'prisma generate' { npx prisma generate }
    }
}

# ---------------------------------------------------------------- 4. DB push (tuy chon)
if ($DbPush) {
    Write-Step 'Dong bo schema vao CSDL (prisma db push)'
    Invoke-Native 'prisma db push' { npm run db:push }
}

# ---------------------------------------------------------------- 5. Cong
$startPort = $Port
while (Test-PortInUse $Port) {
    $Port++
    if ($Port -gt $startPort + 20) { Fail "Khong tim duoc cong trong tu $startPort." }
}
if ($Port -ne $startPort) { Write-Warn2 "Cong $startPort dang ban, chuyen sang cong $Port." }
$url = "http://localhost:$Port"

# ---------------------------------------------------------------- 6. Mo trinh duyet khi server san sang
if ($Open) {
    Start-Job -ArgumentList $Port, $url -ScriptBlock {
        param($p, $u)
        for ($i = 0; $i -lt 180; $i++) {
            $c = New-Object System.Net.Sockets.TcpClient
            try { $c.Connect('127.0.0.1', $p); $c.Close(); Start-Process $u; return } catch { Start-Sleep -Milliseconds 500 }
        }
    } | Out-Null
}

# ---------------------------------------------------------------- 7. Chay
if ($Prod) {
    Write-Step 'Build production'
    Invoke-Native 'npm run build' { npm run build }
    Write-Step "Chay production tai $url  (Ctrl+C de dung)"
    npx next start -p $Port
} else {
    Write-Step "Chay dev tai $url  (Ctrl+C de dung)"
    npx next dev -p $Port
}
