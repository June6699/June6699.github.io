# SHA-256 (lowercase hex) of UTF-8 password; same as run_server.bat / Hugo env injection.
# Usage (repo root):
#   powershell -NoProfile -File scripts\moments_password_hash.ps1 "your-password"
# Interactive (masked input):
#   powershell -NoProfile -File scripts\moments_password_hash.ps1

param(
    [Parameter(Position = 0)]
    [string] $Plaintext
)

$ErrorActionPreference = "Stop"

try {
    if ([string]::IsNullOrEmpty($Plaintext)) {
        $secure = Read-Host "Password (hidden)" -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $Plaintext = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }

    if ([string]::IsNullOrEmpty($Plaintext)) {
        Write-Host "No password entered; exiting." -ForegroundColor Yellow
        exit 1
    }

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Plaintext)
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    $hex = -join ($hash | ForEach-Object { $_.ToString("x2") })

    Write-Host ""
    Write-Host "HUGO_MOMENTS_PASSWORD_HASH=$hex"
    Write-Host ""
    Write-Host "Add the line above to .env, or copy the hash into GitHub Secret HUGO_MOMENTS_PASSWORD_HASH." -ForegroundColor DarkGray
} catch {
    # Avoid [...] inside double quotes (PowerShell parses it as a type/index expression).
    Write-Host ('moments_password_hash error: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
