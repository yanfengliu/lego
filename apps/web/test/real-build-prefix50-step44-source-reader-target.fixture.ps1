# Static-analysis fixture: hostile text is never executed and must be treated only as pinned bytes.
Invoke-Expression "Write-Output forbidden-if-executed"
. $env:STEP44_COMPUTED_DOT_SOURCE
