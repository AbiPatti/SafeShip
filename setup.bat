@echo off
echo === Whale Risk Detection System Setup ===
echo.

echo [1/3] Setting up Backend...
cd backend
if not exist node_modules (
    call npm install
)
echo Backend dependencies installed.
echo.

echo [2/3] Setting up Frontend...
cd ..\frontend
if not exist node_modules (
    call npm install
)
echo Frontend dependencies installed.
echo.

echo [3/3] Setting up ML Service...
cd ..\ml
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Please install Python 3.8+ first.
    pause
    exit /b 1
)

pip install -r requirements.txt
echo ML dependencies installed.
echo.

echo === Training Whale Detection Model ===
python train_whale_model.py
echo.

echo === Setup Complete! ===
echo.
echo Next steps:
echo 1. Add your MyShipTracking API key to backend/.env
echo 2. Run start.bat to launch all services
echo.
pause
