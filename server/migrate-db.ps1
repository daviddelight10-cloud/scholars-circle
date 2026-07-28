# Scholar's Circle - Database Migration Helper
# Run this script from the server/ folder to push schema changes to your database.
#
# USAGE:
#   1. Make sure server/.env exists with your DATABASE_URL (copy from .env.example)
#   2. Right-click this file -> Run with PowerShell
#      OR open PowerShell in server/ folder and run:  ./migrate-db.ps1

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Scholar's Circle Database Migration" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check .env exists
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: server/.env file not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create server/.env first:" -ForegroundColor Yellow
    Write-Host "  1. Copy server/.env.example to server/.env" -ForegroundColor Yellow
    Write-Host "  2. Open server/.env and paste your DATABASE_URL from Railway" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Check DATABASE_URL is set
$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch "DATABASE_URL\s*=\s*[`"']?postgresql://") {
    Write-Host "ERROR: DATABASE_URL is missing or invalid in server/.env" -ForegroundColor Red
    Write-Host "It should start with: postgresql://" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "Step 1/3: Installing prisma client..." -ForegroundColor Green
npm.cmd install --silent

Write-Host ""
Write-Host "Step 2/3: Generating Prisma client..." -ForegroundColor Green
npx.cmd prisma generate

Write-Host ""
Write-Host "Step 3/3: Pushing schema changes to database..." -ForegroundColor Green
Write-Host "(This will create new tables for: TeacherInvite, LecturerProfile, LecturerRating, LecturerPost, DirectMessage)" -ForegroundColor Gray
Write-Host ""
npx.cmd prisma db push --accept-data-loss

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host "  SUCCESS! Database is now up to date." -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "What's now in your database:" -ForegroundColor Cyan
    Write-Host "  - TeacherInvite (for per-lecturer signup codes)" -ForegroundColor White
    Write-Host "  - LecturerProfile (lecturer directory)" -ForegroundColor White
    Write-Host "  - LecturerRating (student star ratings)" -ForegroundColor White
    Write-Host "  - LecturerPost (lecturer announcements)" -ForegroundColor White
    Write-Host "  - DirectMessage (student-lecturer chat)" -ForegroundColor White
    Write-Host ""
    Write-Host "You can now sign up lecturers from the Teacher Invites tab!" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Red
    Write-Host "  Migration FAILED. See errors above." -ForegroundColor Red
    Write-Host "===============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  - Check your DATABASE_URL in server/.env is correct" -ForegroundColor White
    Write-Host "  - Make sure Railway database is running" -ForegroundColor White
    Write-Host "  - Check your internet connection" -ForegroundColor White
}

Write-Host ""
pause
