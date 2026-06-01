<#
  test-rung-3.ps1 — exercises the scratch-03 queue (lib/scratch-rung-3.ts)

  What it checks:
    1. POST /scratch-03/api/resize          -> returns 202 + jobId
    2. GET  /scratch-03/api/resize/stats     -> active never exceeds concurrency (4), pending drains
    3. GET  /scratch-03/api/resize/{id}      -> each job ends up status "done" with a resultsDataUrl

  Prereq: dev server running ->  npm run dev   (http://localhost:3009)

  Usage:
    pwsh ./scripts/test-rung-3.ps1
    pwsh ./scripts/test-rung-3.ps1 -Jobs 6 -Image C:\path\to\photo.jpg
#>

param(
    [string]$BaseUrl = 'http://localhost:3009',
    [int]$Jobs = 6,
    [string]$Image
)

$ErrorActionPreference = 'Stop'

# --- 1. Make sure we have a test image -------------------------------------
if (-not $Image) {
    $Image = Join-Path $env:TEMP 'rung3-test.png'
    if (-not (Test-Path $Image)) {
        # tiny valid 1x1 PNG — enough to drive the sharp pipeline
        $b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        [IO.File]::WriteAllBytes($Image, [Convert]::FromBase64String($b64))
    }
}
Write-Host "Using image: $Image" -ForegroundColor Cyan

# --- 2. Fire N uploads as fast as possible ---------------------------------
# NOTE: use curl.exe, not Invoke-RestMethod -Form. PowerShell's multipart body
# trips Next's request.formData() parser and returns 500.
$jobIds = @()
foreach ($i in 1..$Jobs) {
    $out = curl.exe -s -X POST "$BaseUrl/scratch-03/api/resize" -F "image=@$Image;type=image/png"
    $jobId = ($out | ConvertFrom-Json).jobId
    if (-not $jobId) { Write-Warning "upload $i failed: $out"; continue }
    $jobIds += $jobId
    Write-Host ("  enqueued #{0,-2} -> {1}" -f $i, $jobId)
}
Write-Host "Enqueued $($jobIds.Count) jobs`n" -ForegroundColor Green

# --- 3. Watch stats: prove active is capped at concurrency -----------------
Write-Host 'Watching /stats (active must never exceed concurrency):' -ForegroundColor Cyan
$maxActive = 0
for ($t = 0; $t -lt 12; $t++) {
    $s = Invoke-RestMethod -Uri "$BaseUrl/scratch-03/api/resize/stats"
    if ($s.active -gt $maxActive) { $maxActive = $s.active }
    Write-Host ("  active={0}  pending={1}  concurrency={2}" -f $s.active, $s.pendingJobs, $s.concurrency)
    if ($s.active -eq 0 -and $s.pendingJobs -eq 0) { break }
    Start-Sleep -Milliseconds 1000
}
$concurrency = $s.concurrency
if ($maxActive -le $concurrency) {
    Write-Host "PASS: peak active ($maxActive) <= concurrency ($concurrency)`n" -ForegroundColor Green
} else {
    Write-Host "FAIL: peak active ($maxActive) > concurrency ($concurrency)`n" -ForegroundColor Red
}

# --- 4. Poll each job to completion ----------------------------------------
Write-Host 'Polling jobs to completion:' -ForegroundColor Cyan
$done = 0; $failed = 0
foreach ($id in $jobIds) {
    for ($t = 0; $t -lt 30; $t++) {
        $r = Invoke-RestMethod -Uri "$BaseUrl/scratch-03/api/resize/$id"
        $job = $r.job          # status route wraps the result in { job: {...} }
        if ($job.status -in 'done', 'failed') { break }
        Start-Sleep -Milliseconds 500
    }
    if ($job.status -eq 'done') {
        $done++
        Write-Host ("  {0}  done   (dataUrl {1} chars)" -f $id, $job.resultsDataUrl.Length) -ForegroundColor Green
    } else {
        $failed++
        Write-Host ("  {0}  {1}  {2}" -f $id, $job.status, $job.error) -ForegroundColor Red
    }
}

Write-Host ("`nSummary: {0} done, {1} failed, of {2}" -f $done, $failed, $jobIds.Count) `
    -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Red' })
