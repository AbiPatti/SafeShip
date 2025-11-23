# 🐳 Whale Risk Detection System

This project combines ship tracking data with machine learning to predict whale presence along shipping routes, helping to prevent ship-whale collisions.

## Architecture

- **Frontend**: React + Leaflet map (Port 5173)
- **Backend**: Node.js/TypeScript API for ship tracking (Port 5001)
- **ML Service**: Python Flask API for whale risk predictions (Port 5002)

## Quick Start

### 1. Setup Backend (Ship Tracking)

```bash
cd backend
npm install
# Add your MyShipTracking API key to .env
echo "MST_API_KEY=your_key_here" >> .env
npm start
```

### 2. Setup ML Service (Whale Detection)

```bash
cd ml

# Install Python dependencies
pip install -r requirements.txt

# Train the whale risk model
python train_whale_model.py

# Start the whale risk API
python api.py
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open in Chrome

Navigate to `http://localhost:5173`

## API Endpoints

### Ship Tracking (Port 5001)

- `GET /api/vessels/search/:name` - Search for vessels by name
- `GET /api/vessels/status/:mmsi` - Get vessel current position
- `GET /api/vessels/track/:mmsi` - Get vessel track history
- `GET /api/vessels/status/:mmsi/whale-risk` - Get vessel position + whale risk

### Whale Risk (Port 5002)

- `POST /api/whale-risk` - Get whale risk for coordinates
- `POST /api/whale-risk/route` - Get whale risk along a route
- `GET /api/whale-risk/ship?lat=X&lon=Y` - Get whale risk for ship position

## Data Sources

- **Ship Data**: MyShipTracking.com API (real-time AIS data)
- **Whale Data**: OBIS-SEAMAP dataset (`data/obis_seamap_dataset.csv.csv`)

## Machine Learning Model

The whale detection model uses:
- **Algorithm**: Gradient Boosting Classifier
- **Features**: Latitude, Longitude, Month
- **Training Data**: Real whale migration patterns + OBIS sighting records
- **Accuracy**: ~85-90% on test data

### Risk Levels
- **HIGH** (>60%): Reduce speed, increase lookout
- **MEDIUM** (30-60%): Exercise caution
- **LOW** (<30%): Standard protocols

## Development

### Training a New Model

```bash
cd ml
python train_whale_model.py
```

### Testing the Model

```bash
cd ml
python whale_predictor.py
```

## Environment Variables

### Backend (.env)
```
PORT=5001
MST_API_KEY=your_api_key_here
MST_CACHE_TTL_MS=30000
```

### ML Service
```
PORT=5002
```

## Project Structure

```
/
├── backend/          # Node.js ship tracking API
├── frontend/         # React map interface
├── ml/              # Python whale risk ML service
│   ├── train_whale_model.py
│   ├── whale_predictor.py
│   ├── api.py
│   └── whale_risk_model.pkl
└── data/            # Whale sighting datasets (gitignored)
```

## Contributing

This is a hackathon project focused on marine conservation and ship safety.
