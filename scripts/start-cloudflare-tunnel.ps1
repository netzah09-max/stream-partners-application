param(
  [int]$Port = 3000
)

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not $cloudflared) {
  throw "cloudflared was not found. Install it from https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/"
}

Write-Host "Starting a temporary Cloudflare Tunnel for http://localhost:$Port"
Write-Host "Keep this window open while you want the public website link to work."
Write-Host ""

& $cloudflared.Source tunnel --url "http://localhost:$Port"
