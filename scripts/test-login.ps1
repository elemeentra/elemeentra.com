# Elemeentra — Login flow test script (Windows PowerShell 5.1 compatible)
# Usage: Edit $email and $correctPassword below, then run:  .\test-login.ps1

$baseUrl = "http://localhost:3000"
$email = "you@elemeentra.com"          # <-- your seeded Super Admin email
$correctPassword = "REPLACE_ME"        # <-- your seeded Super Admin password
$wrongPassword = "definitely-wrong-pw"

function Try-Login {
    param([string]$pw, [Microsoft.PowerShell.Commands.WebRequestSession]$session)

    $body = (@{ email = $email; password = $pw } | ConvertTo-Json)
    $params = @{
        Uri         = "$baseUrl/api/auth/login"
        Method      = "POST"
        ContentType = "application/json"
        Body        = $body
    }
    if ($session) {
        $params.WebSession = $session
    } else {
        $params.SessionVariable = "newSession"
    }

    try {
        $res = Invoke-WebRequest @params
        Write-Host "Status: $($res.StatusCode)  Body: $($res.Content)"
        if (-not $session) { return $newSession }
        return $session
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        $status = [int]$resp.StatusCode
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $text = $reader.ReadToEnd()
        Write-Host "Status: $status  Body: $text"
        return $session
    }
}

function Get-Me {
    param([Microsoft.PowerShell.Commands.WebRequestSession]$session)
    try {
        $res = Invoke-WebRequest -Uri "$baseUrl/api/auth/me" -Method GET -WebSession $session
        Write-Host "Body: $($res.Content)"
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Body: $($reader.ReadToEnd())"
    }
}

Write-Host "`n--- Step 1-4: wrong password (expect 401 each) ---"
1..4 | ForEach-Object {
    Write-Host "`nAttempt $_"
    Try-Login -pw $wrongPassword | Out-Null
}

Write-Host "`n--- Step 5: wrong password again (expect 401, account now locked in DB) ---"
Try-Login -pw $wrongPassword | Out-Null

Write-Host "`n--- Step 6: any login now (expect 423 - account locked) ---"
Try-Login -pw $correctPassword | Out-Null

Write-Host "`n--- Now reset lockout in phpMyAdmin:"
Write-Host "    UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = '$email';"
Write-Host "    Then press Enter to continue ---"
Read-Host

Write-Host "`n--- Step 7: correct password (expect 200 + user object) ---"
$session = Try-Login -pw $correctPassword

Write-Host "`n--- Step 8: /api/auth/me while logged in (expect your user object) ---"
Get-Me -session $session

Write-Host "`n--- Step 9: logout ---"
try {
    $logout = Invoke-WebRequest -Uri "$baseUrl/api/auth/logout" -Method POST -WebSession $session
    Write-Host "Status: $($logout.StatusCode)"
} catch [System.Net.WebException] {
    Write-Host "Status: $([int]$_.Exception.Response.StatusCode)"
}

Write-Host "`n--- Step 10: /api/auth/me after logout (expect user: null) ---"
Get-Me -session $session
