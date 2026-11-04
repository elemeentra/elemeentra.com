#!/usr/bin/env powershell
# Quick script to switch database environments

param(
    [ValidateSet('xampp', 'hostinger')]
    [string]$Environment = 'xampp'
)

$envFile = ".env.local"
$xamppFile = ".env.local.xampp"
$hostingerFile = ".env.local.hostinger"

if ($Environment -eq 'xampp') {
    if (Test-Path $xamppFile) {
        Copy-Item $xamppFile $envFile -Force
        Write-Host "✓ Switched to XAMPP (Local)" -ForegroundColor Green
        Write-Host "  Host: localhost:3306" -ForegroundColor Cyan
        Write-Host "  Run: npm run db:migrate" -ForegroundColor Yellow
    } else {
        Write-Host "✗ .env.local.xampp not found" -ForegroundColor Red
    }
} elseif ($Environment -eq 'hostinger') {
    # Create hostinger file from current .env.local (assuming it's hostinger)
    if (Test-Path $envFile) {
        Copy-Item $envFile $hostingerFile -Force
        Write-Host "✓ Saved current .env.local as .env.local.hostinger" -ForegroundColor Green
    } else {
        Write-Host "✗ .env.local not found" -ForegroundColor Red
    }
}
