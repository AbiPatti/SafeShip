Write-Host "=== Starting Whale Risk Detection System ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting ML Service (Python API on port 5002)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ml; python api.py"
Start-Sleep -Seconds 3

Write-Host "Starting Backend (Node API on port 5001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm start"
Start-Sleep -Seconds 3

Write-Host "Starting Frontend (Vite on port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host ""
Write-Host "=== All services starting! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Backend API:     http://localhost:5001" -ForegroundColor Cyan
Write-Host "ML Service:      http://localhost:5002" -ForegroundColor Cyan
Write-Host "Frontend:        http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop services." -ForegroundColor Gray
