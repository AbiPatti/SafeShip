"""
Flask API for Whale Risk Predictions
Integrates with the shipping route API
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from whale_predictor import WhaleRiskPredictor
import os

app = Flask(__name__)
CORS(app)

# Initialize predictor
predictor = WhaleRiskPredictor()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'whale-risk-api'})

@app.route('/api/whale-risk', methods=['POST'])
def predict_whale_risk():
    """
    Predict whale risk for a location
    
    Request body:
    {
        "latitude": 37.5,
        "longitude": -123.0,
        "month": 6  // optional, defaults to current month
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        lat = data.get('latitude')
        lon = data.get('longitude')
        month = data.get('month')
        
        if lat is None or lon is None:
            return jsonify({'error': 'latitude and longitude are required'}), 400
        
        result = predictor.predict_risk(lat, lon, month)
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/whale-risk/route', methods=['POST'])
def predict_route_risk():
    """
    Predict whale risk along a route
    
    Request body:
    {
        "waypoints": [
            {"lat": 37.5, "lon": -123.0},
            {"lat": 38.0, "lon": -123.5}
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'waypoints' not in data:
            return jsonify({'error': 'waypoints array is required'}), 400
        
        waypoints = data['waypoints']
        
        if not isinstance(waypoints, list) or len(waypoints) == 0:
            return jsonify({'error': 'waypoints must be a non-empty array'}), 400
        
        results = predictor.predict_route(waypoints)
        
        # Calculate overall route risk
        avg_prob = sum(r['probability'] for r in results) / len(results)
        max_risk = max(results, key=lambda x: x['probability'])
        
        return jsonify({
            'waypoints': results,
            'summary': {
                'average_probability': round(avg_prob, 3),
                'highest_risk_location': {
                    'latitude': max_risk['latitude'],
                    'longitude': max_risk['longitude'],
                    'probability': max_risk['probability'],
                    'risk_level': max_risk['risk_level']
                }
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/whale-risk/ship', methods=['GET'])
def ship_whale_risk():
    """
    Get whale risk for a ship's current position
    Query params: ?mmsi=<mmsi>&lat=<lat>&lon=<lon>
    """
    try:
        mmsi = request.args.get('mmsi')
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        
        if lat is None or lon is None:
            return jsonify({'error': 'lat and lon query parameters are required'}), 400
        
        result = predictor.predict_risk(lat, lon)
        
        if mmsi:
            result['mmsi'] = mmsi
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    print(f"🐳 Starting Whale Risk API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
