# Output SHA-256 (lowercase hex) of UTF-8 plaintext to stdout only (for run_server.bat for /f).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\hash_plain_for_batch.ps1 "plaintext"
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Plaintext
)
$bytes = [System.Text.Encoding]::UTF8.GetBytes($Plaintext)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
[Console]::Out.Write(-join ($hash | ForEach-Object { $_.ToString("x2") }))
