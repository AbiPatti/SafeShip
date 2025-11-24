# SafeShip - AI-Powered Marine Safety Platform

>**Note**: This project was built in 24 hours for the Sheridan Datathon in collaboration with [@YeehawMcfly](https://github.com/YeehawMcfly) and [@Abhiroop-Tech](https://github.com/Abhiroop-Tech).

Each year, an estimated 20,000 whales are killed globally by collisions with vessels, making these collisions the leading cause of death for large whale species. This ongoing threat endangers the survival of these “ecosystem engineers”, posing a detrimental effect throughout the marine ecosystem.

To address the issue, we created the SafeShip initiative, a data-driven platform that not only monitors whale habitats, but also evaluates the risk of routes in real time and gives instantaneous rerouting suggestions. This initiative aims to save lives and protect vital marine biodiversity, while maintaining the efficiency of global shipping operations.

## Overview
SafeShip is a full-stack maritime safety platform designed to prevent collisions between commercial vessels and large whale species. It integrates real-time AIS vessel tracking, machine learning risk prediction, and LLM-generated safety briefings to provide actionable insights for bridge crews.

## Key Features

### 1. Real-Time Ship Tracking
- Search vessels by name (e.g., "EVER GIVEN")
- View ships near your location or in bounding box
- Query ships in specific ports
- Live AIS position updates

### 2. Whale Risk Detection (ML)
- Predicts whale presence risk: **HIGH / MEDIUM / LOW**
- Trained on OBIS-SEAMAP whale sighting dataset
- Features: latitude, longitude, month (seasonal patterns)
- ~85-90% accuracy

### 3. Gemini AI Safety Briefings (Multimodal)
- **Visual Analysis**: AI sees the map screenshot (html2canvas)
- **Context-Aware**: Integrates vessel data, track history, whale risk
- **Natural Language**: Bridge crew briefings with actionable recommendations
- **Markdown Rendering**: Beautiful formatted output


## Architecture

The system utilizes a microservices architecture with a React frontend, Node.js backend gateway, and a Python/Flask machine learning service.

```
┌─────────────────────────────────────────────┐
│  Frontend (React + Leaflet + Gemini UI)   │  Port 5173
│  - Interactive ship map                    │
│  - Real-time vessel tracking               │
│  - AI safety briefings                     │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│  Backend API     │  │  ML Service      │
│  (Node/TS)       │  │  (Python/Flask)  │
│  Port 5001       │  │  Port 5002       │
│                  │  │                  │
│ • Ship tracking  │  │ • Whale risk     │
│ • Gemini AI      │  │   prediction     │
│ • Route calc     │  │ • GBM classifier │
└──────────────────┘  └──────────────────┘
         │                   │
         ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│ MyShipTracking   │  │ OBIS Whale Data  │
│ AIS API          │  │ (trained model)  │
└──────────────────┘  └──────────────────┘
```

## Tech Stack

- **Frontend:** React, TypeScript, Leaflet, Vite, html2canvas, react-icons, marked
- **Backend:** Node.js, Express, TypeScript, Axios, @google/generative-ai
- **ML:** Python, Flask, scikit-learn, pandas, numpy
- **Data:** MyShipTracking API (AIS), OBIS-SEAMAP (whale sightings)

## Quick Setup (Windows)

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- MyShipTracking API key ([Get one here](https://www.myshiptracking.com))
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

### Step 1: Install Dependencies

Run the automated setup script to install all dependencies:

```powershell
.\setup.bat
```

This will:
- Install Node.js packages for backend & frontend
- Install Python dependencies for ML service
- Train the whale risk detection model

### Step 2: Configure API Keys

1. Navigate to `backend` folder
2. Copy `.env.template` to `.env`:
   ```powershell
   cd backend
   copy .env.template .env
   ```
3. Edit `.env` and add your API keys:
   ```env
   MST_API_KEY=your_myshiptracking_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Step 3: Start All Services

Run the startup script (uses fixed Python path for ML service):

```powershell
.\start_fixed.ps1
```

This will launch:
- **ML Service** on `http://localhost:5002` (Python Flask)
- **Backend API** on `http://localhost:5001` (Node.js/Express)
- **Frontend** on `http://localhost:5173` (React + Vite)

### Step 4: Open the App

Navigate to **http://localhost:5173** in your browser.

---

---

## API Endpoints

### Backend (Port 5001)

**Ship Tracking:**
- `GET /api/vessels/search/:name` - Search vessels
- `GET /api/vessels/status/:mmsi` - Current position (extended AIS data)
- `GET /api/vessels/track/:mmsi?days=1` - Historical track
- `GET /api/vessels/status/:mmsi/whale-risk` - Position + risk

**AI Insights:**
- `POST /api/gemini/insight` - Generate Gemini safety briefing
  ```json
  {
    "ship": { "lat": 35.2, "lon": 139.5, "mmsi": "311918000", ... },
    "track": [...],
    "question": "What should the bridge team know?",
    "mapSnapshot": { "dataUrl": "data:image/png;base64,...", "mimeType": "image/png" }
  }
  ```

**Whale Risk:**
- `POST /api/whale-risk` - Get risk for coordinates

### ML Service (Port 5002)

- `POST /api/whale-risk` - Risk prediction
  ```json
  { "latitude": 40.7, "longitude": -74.0, "month": 11 }
  ```

---

## Machine Learning Model

**Algorithm:** Gradient Boosting Classifier  
**Features:** Latitude, Longitude, Month  
**Training Data:** OBIS-SEAMAP whale sightings + synthetic migration patterns  

**Risk Thresholds:**
- 🔴 **HIGH** (>60%): Reduce speed to <10 knots, post whale watch
- 🟡 **MEDIUM** (30-60%): Exercise caution, brief crew
- 🟢 **LOW** (<30%): Standard protocols

**Model Files:**
- `ml/whale_risk_model.pkl` - Trained classifier
- `ml/train_whale_model.py` - Training script
- `ml/whale_predictor.py` - Standalone predictor

---

## Environment Variables

### Backend (`backend/.env`)
```env
PORT=5001
MST_API_KEY=your_myshiptracking_api_key
MST_CACHE_TTL_MS=30000
MST_DEFAULT_MINUTES_BACK=60
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-lite
```

### ML Service
No configuration needed (port 5002 hardcoded).

---

## Project Structure

```
/
├── backend/                 # Node.js/TypeScript API
│   ├── src/
│   │   ├── classes/server.ts     # Express routes
│   │   ├── services/
│   │   │   ├── mstClient.ts      # MyShipTracking client
│   │   │   ├── whaleRiskService.ts
│   │   │   └── geminiService.ts  # Gemini AI integration
│   │   └── index.ts
│   ├── .env.template
│   └── package.json
│
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── components/ShipMap.tsx  # Main map UI
│   │   ├── App.css                 # Styling
│   │   └── main.tsx
│   └── package.json
│
├── ml/                      # Python Flask ML service
│   ├── api.py                      # Flask server
│   ├── train_whale_model.py        # Model training
│   ├── whale_predictor.py          # Inference script
│   ├── whale_risk_model.pkl        # Trained model
│   └── requirements.txt
│
├── setup.bat                # Dependency installer
├── start_fixed.ps1          # Startup script (all services)
└── README.md
```

---

## Development

### Retrain ML Model
```powershell
cd ml
python train_whale_model.py
```

### Manual Service Startup

**Backend:**
```powershell
cd backend
npm start
```

**ML Service:**
```powershell
cd ml
python api.py
```

**Frontend:**
```powershell
cd frontend
npm run dev
```

## License
>This project is licensed under the MIT License. See [LICENSE](LICENSE) for more details.
