# Marion Wx Map Windows server (no Python)
param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$Root = $PSScriptRoot
$Prefix = 'http://127.0.0.1:' + [string]$Port + '/'
$Listener = [System.Net.HttpListener]::new()
$Listener.Prefixes.Add($Prefix)
try {
  $Listener.Start()
} catch {
  Write-Host 'Could not bind port. Close the other Marion Wx window first.'
  Write-Host $_
  exit 1
}
Write-Host ('Marion Wx Map  ' + $Prefix)
Write-Host 'Ctrl+C to stop.'
Start-Process $Prefix

function Send-Bytes($ctx, [int]$status, [string]$contentType, [byte[]]$bytes) {
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = $contentType
  $ctx.Response.Headers.Add('Access-Control-Allow-Origin', '*')
  $ctx.Response.Headers.Add('Cache-Control', 'no-store')
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}
function Send-Text($ctx, [int]$status, [string]$contentType, [string]$text) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  Send-Bytes $ctx $status $contentType $bytes
}
$Mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.svg'  = 'image/svg+xml'
  '.md'   = 'text/plain; charset=utf-8'
}
function Get-Query([System.Uri]$uri, [string]$name, [string]$default) {
  $amp = [char]38
  $raw = $uri.Query.TrimStart('?')
  if ([string]::IsNullOrWhiteSpace($raw)) { return $default }
  foreach ($pair in $raw.Split($amp)) {
    if (-not $pair) { continue }
    $kv = $pair.Split('=', 2)
    if ($kv[0] -eq $name) {
      if ($kv.Length -lt 2) { return $default }
      return [uri]::UnescapeDataString($kv[1])
    }
  }
  return $default
}
function Get-AdsB([double]$lat, [double]$lon, [int]$dist) {
  $inv = [System.Globalization.CultureInfo]::InvariantCulture
  $latS = $lat.ToString('F4', $inv)
  $lonS = $lon.ToString('F4', $inv)
  $url = 'https://api.adsb.lol/v2/point/' + $latS + '/' + $lonS + '/' + [string]$dist
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8 -UserAgent 'MarionWxMap/1.0'
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300 -and $resp.Content) {
      return [string]$resp.Content
    }
  } catch {}
  return $null
}
while ($Listener.IsListening) {
  $ctx = $Listener.GetContext()
  $req = $ctx.Request
  $path = $req.Url.AbsolutePath
  try {
    if ($req.HttpMethod -eq 'OPTIONS') {
      $ctx.Response.StatusCode = 204
      $ctx.Response.Headers.Add('Access-Control-Allow-Origin', '*')
      $ctx.Response.Headers.Add('Access-Control-Allow-Methods', 'GET, OPTIONS')
      $ctx.Response.Close()
      continue
    }
    if ($path -eq '/proxy/health') {
      Send-Text $ctx 200 'application/json' '{"ok":true,"service":"marion-wx-map"}'
      continue
    }
    if ($path -eq '/proxy/adsb') {
      $lat = 36.8344
      $lon = -81.5148
      $dist = 150
      try {
        $lat = [double](Get-Query $req.Url 'lat' '36.8344')
        $lon = [double](Get-Query $req.Url 'lon' '-81.5148')
        $dist = [int][double](Get-Query $req.Url 'dist' '150')
      } catch {
        Send-Text $ctx 400 'application/json' '{"error":"bad lat lon dist"}'
        continue
      }
      if ($dist -lt 10) { $dist = 10 }
      if ($dist -gt 250) { $dist = 250 }
      $body = Get-AdsB $lat $lon $dist
      if (-not $body) {
        Send-Text $ctx 502 'application/json' '{"error":"ADS-B upstream failed"}'
        continue
      }
      $trim = $body.TrimStart()
      $q = [char]34
      $b = [char]123
      if ($trim.StartsWith([string]$b)) {
        $inj = '{' + $q + '_source' + $q + ':' + $q + 'adsb.lol' + $q + ','
        $body = $inj + $trim.Substring(1)
      }
      Send-Text $ctx 200 'application/json' $body
      continue
    }
    if ($path -eq '/') { $path = '/index.html' }
    $rel = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    if ($rel.Contains('..')) {
      Send-Text $ctx 400 'text/plain' 'bad path'
      continue
    }
    $file = Join-Path $Root $rel
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
      Send-Text $ctx 404 'text/plain' 'not found'
      continue
    }
    $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
    $ctype = $Mime[$ext]
    if (-not $ctype) { $ctype = 'application/octet-stream' }
    $bytes = [IO.File]::ReadAllBytes($file)
    Send-Bytes $ctx 200 $ctype $bytes
  } catch {
    try { Send-Text $ctx 500 'text/plain' 'error' } catch {}
  }
}
