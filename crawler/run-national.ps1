# All-day national gosom push (Windows PowerShell).
# Loops every state one at a time — generate queries -> gosom scrape -> ingest to
# Neon -> log the `done:` line -> mark the state complete. Checkpointed and
# RESUMABLE: re-running skips states already marked done (out/done-<ST>.flag), so
# you can Ctrl+C any time and pick up where you left off tomorrow.
#
# Prereqs (same as gosom-local.md):
#   - Docker Desktop running (green whale)
#   - Python deps installed:  pip install -r requirements.txt
#   - $env:DATABASE_URL set to your Neon URL  (single quotes — it contains '&')
# Optional: $env:CRAWL_NOTIFY_WEBHOOK = 'https://discord.com/api/webhooks/...'
#   (or any Slack/Discord-style incoming webhook) — the script POSTs each state's
#   `done:` line and a final "ALL DONE" summary there, so you (and Claude) get
#   pinged as it progresses without watching the terminal.
#
# Usage (from the crawler folder):
#   $env:DATABASE_URL = 'postgresql://...'
#   .\run-national.ps1
#   # cover only some states:   .\run-national.ps1 -States TX,KY,OK
#   # start fresh (ignore flags): .\run-national.ps1 -Fresh

param(
  [string[]]$States,
  [switch]$Fresh
)

$ErrorActionPreference = "Continue"

if (-not $env:DATABASE_URL) {
  Write-Host "ERROR: `$env:DATABASE_URL is not set. Set it first, e.g.:" -ForegroundColor Red
  Write-Host "  `$env:DATABASE_URL = 'postgresql://...your-neon-url...'" -ForegroundColor Yellow
  exit 1
}

# Quick Docker daemon check so we fail fast instead of per-state.
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Docker daemon not reachable. Start Docker Desktop (green whale) and retry." -ForegroundColor Red
  exit 1
}

# States ordered by rough horse population — highest-value first, so if you stop
# early the states that matter most are already captured. (CA already crawled;
# it's near the end as a lower-priority re-run.)
$AllStates = @(
  "TX","KY","OK","MO","OH","TN","NC","GA","VA","PA","CO","IL","MI","IN","WI",
  "AL","WA","MN","IA","KS","AR","MS","NE","SC","AZ","NM","OR","ID","MD","NY",
  "NJ","MA","WV","WY","MT","ND","SD","UT","NV","CT","NH","ME","VT","DE","RI",
  "FL","CA"
)
if ($States) { $AllStates = $States }

New-Item -ItemType Directory -Force -Path "out" | Out-Null
$log = "national-crawl-log.txt"
function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Write-Host $line
  Add-Content -Path $log -Value $line
}

function Notify($msg) {
  if ($env:CRAWL_NOTIFY_WEBHOOK) {
    try {
      $body = @{ content = $msg } | ConvertTo-Json
      Invoke-RestMethod -Uri $env:CRAWL_NOTIFY_WEBHOOK -Method Post -ContentType 'application/json' -Body $body | Out-Null
    } catch { Write-Host "  (notify failed: $_)" -ForegroundColor DarkYellow }
  }
}

Log "=== national push start - $($AllStates.Count) states ==="
Notify "national crawl started - $($AllStates.Count) states queued"

foreach ($st in $AllStates) {
  $flag = "out/done-$st.flag"
  if ((Test-Path $flag) -and -not $Fresh) { Log "skip $st (already done)"; continue }

  Log "--- $st : generating queries ---"
  python gen_gmaps_queries.py --state $st --out "queries-$st.txt"
  if ($LASTEXITCODE -ne 0) { Log "$st : gen failed, skipping"; continue }

  Log "$st : scraping (gosom)…"
  docker run --rm `
    -v gmaps-cache:/opt `
    -v "${PWD}/queries-$st.txt:/queries.txt:ro" `
    -v "${PWD}/out:/out" `
    gosom/google-maps-scraper `
    -input /queries.txt -results "/out/results-$st.json" -json -depth 20 -c 8 -exit-on-inactivity 3m
  if ($LASTEXITCODE -ne 0) { Log "$st : gosom exited non-zero (throttled? no results?), continuing to ingest anyway" }

  if (-not (Test-Path "out/results-$st.json")) { Log "$st : no results file, skipping ingest"; continue }

  Log "$st : ingesting to Neon…"
  # Stream ingest output live AND capture it, so we can pull the summary.
  python run.py --source gmaps-file --file "out/results-$st.json" --no-llm 2>&1 | Tee-Object -Variable out
  # run.py prints "  done: …" (indented) then a "review breakdown" of non-barn
  # types. Grab the done line for the log, and write a compact per-state report
  # (done + breakdown) to paste to Claude for the filtering/QA pass.
  $done = ($out | Select-String -Pattern '^\s*done:' | Select-Object -Last 1)
  if (-not $done) { $done = ($out | Select-Object -Last 1) }
  Log "$st : $($done.ToString().Trim())"
  Notify "[$st] $($done.ToString().Trim())"

  $reportLines = $out |
    Select-String -Pattern '^\s*done:|review breakdown|e\.g\.' |
    ForEach-Object { $_.ToString().TrimEnd() }
  Set-Content -Path "out/report-$st.txt" -Value (@("=== $st  ($(Get-Date -Format 'u')) ===") + $reportLines)
  Log "$st : wrote out/report-$st.txt (paste to Claude for filtering/QA)"

  New-Item -ItemType File -Force -Path $flag | Out-Null
}

Log "=== national push COMPLETE ==="
$nl = [Environment]::NewLine
$summary = (Get-Content $log | Select-String -Pattern ': done:' | ForEach-Object { $_.ToString() }) -join $nl
Notify ("ALL DONE - national crawl finished." + $nl + $summary)
Write-Host ""
Write-Host "Done. Paste the contents of $log to Claude to read the national lift." -ForegroundColor Green
