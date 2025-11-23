import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

print("--- 🐳 Training Whale Risk Model with REAL DATA ---")

# Load the actual whale sighting data
data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'obis_seamap_dataset.csv')
print(f"Loading data from: {data_path}")

try:
    # Read the actual OBIS dataset
    df_raw = pd.read_csv(data_path)
    print(f"✅ Loaded {len(df_raw)} records from OBIS-SEAMAP dataset")
    
    # Extract actual whale sightings with coordinates and dates
    whale_sightings = []
    
    for _, row in df_raw.iterrows():
        try:
            lat = float(row['latitude'])
            lon = float(row['longitude'])
            
            # Extract month from date_time column
            date_str = str(row['date_time'])
            
            # Handle space separator (e.g., "1990-04-10 12:00:00")
            if ' ' in date_str:
                date_str = date_str.split(' ')[0]
            if 'T' in date_str:
                date_str = date_str.split('T')[0]
            
            if '-' in date_str:
                parts = date_str.split('-')
                if len(parts) >= 2:
                    month = int(parts[1])
                else:
                    continue
            else:
                continue
            
            # Only include if we have valid data
            if -90 <= lat <= 90 and -180 <= lon <= 180 and 1 <= month <= 12:
                whale_sightings.append([lat, lon, month, 1])  # 1 = whale present
                
        except (ValueError, KeyError, TypeError):
            continue
    
    print(f"📊 Extracted {len(whale_sightings)} valid whale sightings from dataset")
    
    if len(whale_sightings) < 100:
        raise Exception("Not enough valid whale sightings in dataset")
    
    # Add non-sighting data (random ocean points without whales)
    # IMPORTANT: Sample from the SAME geographic region where we have whale data
    # This ensures the model learns WHERE whales are vs where they're NOT
    print("Generating negative samples (nearby ocean points without whales)...")
    
    # Get actual sighting locations
    sighting_coords = set((s[0], s[1]) for s in whale_sightings)
    
    # For each whale sighting, create negative samples nearby
    negative_samples = []
    for lat, lon, month, _ in whale_sightings:
        # Create 2-3 nearby points that are NOT actual sightings
        for _ in range(2):
            # Offset by 0.5-3 degrees in random direction
            offset_lat = np.random.uniform(-3, 3)
            offset_lon = np.random.uniform(-3, 3)
            
            new_lat = lat + offset_lat
            new_lon = lon + offset_lon
            
            # Make sure it's not an actual sighting location
            if (round(new_lat, 4), round(new_lon, 4)) not in sighting_coords:
                if -90 <= new_lat <= 90 and -180 <= new_lon <= 180:
                    # Random month to avoid seasonal bias
                    rand_month = np.random.randint(1, 13)
                    negative_samples.append([new_lat, new_lon, rand_month, 0])
    
    # Combine positive and negative samples
    all_samples = whale_sightings + negative_samples
    
    df = pd.DataFrame(all_samples, columns=['latitude', 'longitude', 'month', 'present'])
    print(f"📊 Training Dataset: {len(df)} records")
    print(f"   Whale present: {df['present'].sum()} ({df['present'].mean():.1%})")
    print(f"   No whale: {(df['present']==0).sum()} ({(df['present']==0).mean():.1%})")
    
    # Get geographic range from actual data
    lats = [s[0] for s in whale_sightings]
    lons = [s[1] for s in whale_sightings]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    print(f"   Geographic range: Lat {min_lat:.1f} to {max_lat:.1f}, Lon {min_lon:.1f} to {max_lon:.1f}")

except Exception as e:
    print(f"⚠️ Error loading data: {e}")
    print("Using enhanced simulation based on real patterns...")
    
    # Fallback: Enhanced simulation based on real whale migration patterns
    data = []
    for _ in range(2000):
        lat = np.random.uniform(30, 50)
        lon = np.random.uniform(-130, -120)
        month = np.random.randint(1, 13)
        
        # Real pattern: Humpback whales migrate north in summer (May-Sept)
        # Gray whales peak Dec-Feb (southbound) and Mar-May (northbound)
        is_summer = 5 <= month <= 9
        is_winter_spring = month in [12, 1, 2, 3, 4]
        is_north = lat > 40
        is_mid = 35 < lat <= 40
        
        # Probability based on real migration patterns
        if is_summer and is_north:
            present = 1 if np.random.random() < 0.75 else 0  # High summer presence
        elif is_winter_spring and is_mid:
            present = 1 if np.random.random() < 0.60 else 0  # Gray whale migration corridor
        elif is_north and month in [4, 5, 10]:
            present = 1 if np.random.random() < 0.45 else 0  # Transition months
        else:
            present = 1 if np.random.random() < 0.08 else 0  # Low baseline
            
        data.append([lat, lon, month, present])
    
    df = pd.DataFrame(data, columns=['latitude', 'longitude', 'month', 'present'])
    print(f"📊 Dataset: {len(df)} simulated records based on real migration patterns")

# Split data for training and testing
X = df[['latitude', 'longitude', 'month']]
y = df['present']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train Gradient Boosting Classifier
print("\n🔧 Training Gradient Boosting Classifier...")
gb_model = GradientBoostingClassifier(
    n_estimators=150,
    learning_rate=0.1,
    max_depth=5,
    random_state=42,
    verbose=1
)
gb_model.fit(X_train, y_train)

# Evaluate the model
y_pred = gb_model.predict(X_test)
train_accuracy = gb_model.score(X_train, y_train)
test_accuracy = accuracy_score(y_test, y_pred)

print("\n📈 Model Performance:")
print(f"   Training Accuracy: {train_accuracy:.2%}")
print(f"   Test Accuracy: {test_accuracy:.2%}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=['No Whale', 'Whale Present']))

# Save the model
model_path = os.path.join(os.path.dirname(__file__), 'whale_risk_model.pkl')
joblib.dump(gb_model, model_path)
print(f"\n✅ SUCCESS: Model saved to '{model_path}'")

# Test predictions for key areas
print("\n🗺️ Sample Predictions for Pacific Shipping Routes:")
test_cases = [
    {'lat': 48, 'lon': -125, 'month': 7, 'desc': 'Vancouver area, July (summer feeding)'},
    {'lat': 37, 'lon': -123, 'month': 1, 'desc': 'San Francisco, January (migration)'},
    {'lat': 33, 'lon': -120, 'month': 12, 'desc': 'Southern California, December (breeding)'},
    {'lat': 45, 'lon': -124, 'month': 5, 'desc': 'Oregon coast, May (northbound migration)'},
]

for case in test_cases:
    X_sample = pd.DataFrame([[case['lat'], case['lon'], case['month']]], 
                           columns=['latitude', 'longitude', 'month'])
    prob = gb_model.predict_proba(X_sample)[0][1]
    print(f"   {case['desc']}: {prob:.1%} whale risk")

print("\n🐳 Model ready for integration with shipping API!")
