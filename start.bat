@echo off
echo === Starting Whale Risk Detection System ===
echo.

echo Starting ML Service (Python API on port 5002)...
start "ML Service" cmd /k "cd ml && python api.py"
timeout /t 3 /nobreak >nul

echo Starting Backend (Node API on port 5001)...
start "Backend" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak >nul

echo Starting Frontend (Vite on port 5173)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo === All services starting! ===
echo.
echo Backend API:     http://localhost:5001
echo ML Service:      http://localhost:5002
echo Frontend:        http://localhost:5173
echo.
echo Press any key to continue...
pause >nul
