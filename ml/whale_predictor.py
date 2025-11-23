"""
Whale Risk Prediction API
Predicts whale presence probability for given coordinates and time
"""
import joblib
import pandas as pd
import os
from datetime import datetime

class WhaleRiskPredictor:
    def __init__(self, model_path='whale_risk_model.pkl'):
        """Load the trained whale risk model"""
        self.model_path = os.path.join(os.path.dirname(__file__), model_path)
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load the model from disk"""
        try:
            self.model = joblib.load(self.model_path)
            print(f"✅ Whale risk model loaded from {self.model_path}")
        except Exception as e:
            print(f"⚠️ Could not load model: {e}")
            print("Please run train_whale_model.py first!")
            raise
    
    def predict_risk(self, latitude, longitude, month=None):
        """
        Predict whale presence probability for a given location
        
        Args:
            latitude (float): Latitude coordinate
            longitude (float): Longitude coordinate
            month (int, optional): Month (1-12). Defaults to current month.
        
        Returns:
            dict: Contains risk_level, probability, and recommendation
        """
        if month is None:
            month = datetime.now().month
        
        # Create input dataframe
        X = pd.DataFrame([[latitude, longitude, month]], 
                        columns=['latitude', 'longitude', 'month'])
        
        # Get probability
        probability = self.model.predict_proba(X)[0][1]
        
        # Determine risk level
        if probability > 0.6:
            risk_level = "HIGH"
            recommendation = "Reduce speed to 10 knots or less. Increase lookout."
        elif probability > 0.3:
            risk_level = "MEDIUM"
            recommendation = "Exercise caution. Post additional lookouts."
        else:
            risk_level = "LOW"
            recommendation = "Maintain standard whale watching protocols."
        
        return {
            'risk_level': risk_level,
            'probability': round(probability, 3),
            'recommendation': recommendation,
            'latitude': latitude,
            'longitude': longitude,
            'month': month
        }
    
    def predict_route(self, waypoints):
        """
        Predict whale risk along a shipping route
        
        Args:
            waypoints (list): List of dicts with 'lat' and 'lon' keys
        
        Returns:
            list: Risk predictions for each waypoint
        """
        month = datetime.now().month
        results = []
        
        for wp in waypoints:
            risk = self.predict_risk(wp['lat'], wp['lon'], month)
            results.append(risk)
        
        return results

if __name__ == "__main__":
    # Test the predictor
    predictor = WhaleRiskPredictor()
    
    print("\n🧪 Testing Whale Risk Predictor:")
    
    # Test cases
    tests = [
        {'lat': 48, 'lon': -125, 'month': 7, 'name': 'Vancouver (Summer)'},
        {'lat': 37, 'lon': -123, 'month': 1, 'name': 'San Francisco (Winter)'},
        {'lat': 45, 'lon': -124, 'month': 5, 'name': 'Oregon (Spring Migration)'},
    ]
    
    for test in tests:
        result = predictor.predict_risk(test['lat'], test['lon'], test['month'])
        print(f"\n📍 {test['name']}")
        print(f"   Risk Level: {result['risk_level']}")
        print(f"   Probability: {result['probability']:.1%}")
        print(f"   Recommendation: {result['recommendation']}")
