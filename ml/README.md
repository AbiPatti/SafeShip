# Whale Risk ML Model

Python-based machine learning service for predicting whale presence along shipping routes.

## Setup

1. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

2. **Train the model:**
```bash
python train_whale_model.py
```

This will generate `whale_risk_model.pkl` using the whale sighting data.

3. **Test the predictor:**
```bash
python whale_predictor.py
```

4. **Start the API server:**
```bash
python api.py
```

The API will run on `http://localhost:5002`

## API Endpoints

### POST /api/whale-risk
Predict whale risk for a single location.

**Request:**
```json
{
  "latitude": 37.5,
  "longitude": -123.0,
  "month": 6
}
```

**Response:**
```json
{
  "risk_level": "HIGH",
  "probability": 0.723,
  "recommendation": "Reduce speed to 10 knots or less. Increase lookout.",
  "latitude": 37.5,
  "longitude": -123.0,
  "month": 6
}
```

### POST /api/whale-risk/route
Predict whale risk along a route with multiple waypoints.

**Request:**
```json
{
  "waypoints": [
    {"lat": 37.5, "lon": -123.0},
    {"lat": 38.0, "lon": -123.5}
  ]
}
```

### GET /api/whale-risk/ship
Get whale risk for a ship's position.

**Query:** `?lat=37.5&lon=-123.0&mmsi=123456789`

## Integration with Backend

The Node.js backend can call this Python API to enrich ship position data with whale risk information.

Example from Node.js:
```javascript
const response = await fetch('http://localhost:5002/api/whale-risk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ latitude: 37.5, longitude: -123.0 })
});
const whaleRisk = await response.json();
```
