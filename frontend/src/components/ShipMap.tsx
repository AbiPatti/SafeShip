import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Ship {
  name: string;
  id: string;
  lat: number;
  lon: number;
  timestamp: string;
  mmsi: string;
  imo: string;
  callsign?: string;
  speed?: number;
  area?: string;
  type?: string;
  country?: string;
  destination?: string;
  port_current?: string;
  port_next?: string;
  course?: number | null;
  nav_status?: string | null;
  source?: string;
  whaleRisk?: WhaleRisk;
}

interface WhaleRisk {
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  probability: number;
  recommendation: string;
}

interface SearchResult {
  vessel_name: string;
  mmsi: number;
  imo?: number;
  vtype: number;
  vessel_type: string;
  flag: string;
  area: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? 'http://localhost:5001';

// Component to center map
const MapRecenter = ({ lat, lon, zoom }: { lat: number; lon: number; zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom ?? map.getZoom());
  }, [lat, lon, zoom, map]);
  return null;
};

// Component to fit bounds to track
const TrackFitter = ({ track }: { track: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (track.length > 0) {
      const bounds = L.latLngBounds(track);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [track, map]);
  return null;
};

const ShipMap = () => {
  const [ships, setShips] = useState<Ship[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [track, setTrack] = useState<[number, number][]>([]);
  const [destinationPath, setDestinationPath] = useState<[number, number][]>([]);
  const [headingLine, setHeadingLine] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'area' | 'nearMe' | 'port' | 'search'>('search');
  const [searchParams, setSearchParams] = useState({
    lat: 36.14,
    lon: -5.35,
    distance: 5, // Reduced default distance to save credits
    minLat: 36.5,
    maxLat: 38.5,
    minLon: -124,
    maxLon: -121,
    minutesBack: 60, // Default to 60 as per API requirement
    port: 'Hamburg',
    name: ''
  });
  const [debugUrl, setDebugUrl] = useState<string>('');
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);

  const buildUrl = (path: string, params?: Record<string, string | number | undefined>) => {
    const url = new URL(path, API_BASE_URL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  };

  const toNumber = (value: string, fallback: number) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  // Calculate a point based on start, distance (nm), and bearing (degrees)
  const calculateDestination = (lat: number, lon: number, distanceNm: number, bearing: number): [number, number] => {
    const R = 6371e3; // Earth radius in meters
    const d = distanceNm * 1852; // Distance in meters
    const φ1 = lat * Math.PI / 180;
    const λ1 = lon * Math.PI / 180;
    const θ = bearing * Math.PI / 180;

    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d / R) +
      Math.cos(φ1) * Math.sin(d / R) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d / R) * Math.cos(φ1),
      Math.cos(d / R) - Math.sin(φ1) * Math.sin(φ2));

    return [φ2 * 180 / Math.PI, λ2 * 180 / Math.PI];
  };

  const showProjectedRoute = async (ship: Ship) => {
    setLoading(true);
    setHeadingLine([]);
    setDestinationPath([]);
    
    try {
      // 1. Draw Heading Line (50nm projected)
      if (ship.course) {
        const endPoint = calculateDestination(ship.lat, ship.lon, 50, ship.course);
        setHeadingLine([[ship.lat, ship.lon], endPoint]);
      }

      // 2. Try to find Destination Port
      if (ship.destination && ship.destination.length > 2) {
        // Clean destination string (remove ETA, etc if needed, but simple is better for now)
        const query = encodeURIComponent(ship.destination);
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
        
        const response = await axios.get(nominatimUrl);
        if (response.data && response.data.length > 0) {
          const destLat = parseFloat(response.data[0].lat);
          const destLon = parseFloat(response.data[0].lon);
          setDestinationPath([[ship.lat, ship.lon], [destLat, destLon]]);
          alert(`Projected route to ${ship.destination} (approximate).`);
        } else {
          alert(`Could not find coordinates for destination: "${ship.destination}". Showing heading only.`);
        }
      } else {
        alert("No destination specified for this ship.");
      }
    } catch (e) {
      console.error("Failed to project route", e);
      alert("Failed to calculate projected route.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTrack = async (mmsi: string, days: number = 1) => {
    setLoading(true);
    try {
      const url = buildUrl(`/api/vessels/track/${mmsi}`, { days });
      console.log(`Fetching track for ${mmsi} from ${url}`);
      const response = await axios.get(url);
      console.log("Track response:", response.data);
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        const points = response.data.map((p: any) => [p.lat, p.lng] as [number, number]);
        console.log("Parsed track points:", points);
        setTrack(points);
      } else {
        console.warn("No track data found or invalid format");
        alert(`No track history found for this vessel in the last ${days} day(s). It may be out of terrestrial range.`);
        setTrack([]);
      }
    } catch (e) {
      console.error("Failed to fetch track", e);
      alert("Failed to load track data.");
    } finally {
      setLoading(false);
    }
  };

  const getWhaleRisk = async (lat: number, lon: number): Promise<WhaleRisk | undefined> => {
    try {
      const response = await axios.post(buildUrl('/api/whale-risk'), {
        latitude: lat,
        longitude: lon
      });
      return response.data;
    } catch (e) {
      console.error("Failed to get whale risk:", e);
      return undefined;
    }
  };

  const locateShip = async (mmsi: number) => {
    setLoading(true);
    try {
      const url = buildUrl(`/api/vessels/status/${mmsi}`);
      const response = await axios.get(url);
      const data = response.data;
      if (data && data.lat && data.lng) {
        // Get whale risk for this location
        const whaleRisk = await getWhaleRisk(data.lat, data.lng);
        
        const ship: Ship = {
          name: data.vessel_name,
          id: String(data.mmsi),
          lat: data.lat,
          lon: data.lng,
          timestamp: data.received,
          mmsi: String(data.mmsi),
          imo: String(data.imo || ''),
          type: String(data.vtype),
          speed: data.speed,
          course: data.course,
          destination: data.destination,
          country: data.flag,
          whaleRisk: whaleRisk
        };
        setShips([ship]);
        setCenter({ lat: ship.lat, lon: ship.lon });
        setTrack([]); // Clear old track
      }
    } catch (e) {
      setError("Failed to locate ship");
    } finally {
      setLoading(false);
    }
  };

  const fetchShips = async () => {
    setLoading(true);
    setError(null);
    setShips([]);
    setSearchResults([]);
    setTrack([]);
    
    try {
      let path = '';
      let query: Record<string, string | number | undefined> | undefined;
      
      if (searchType === 'search') {
        if (searchParams.name.length < 3) {
          setError("Search term must be at least 3 characters");
          setLoading(false);
          return;
        }
        path = `/api/vessels/search/${encodeURIComponent(searchParams.name)}`;
      } else if (searchType === 'area') {
        const areaExpression = `bbox:${searchParams.minLat}|${searchParams.minLon}|${searchParams.maxLat}|${searchParams.maxLon}`;
        path = `/legacy/getVesselsInArea/${encodeURIComponent(areaExpression)}`;
        query = { minutesBack: searchParams.minutesBack };
      } else if (searchType === 'nearMe') {
        path = `/legacy/getVesselsNearMe/${searchParams.lat}/${searchParams.lon}/${searchParams.distance}`;
        query = { minutesBack: searchParams.minutesBack };
      } else if (searchType === 'port') {
        path = `/legacy/getVesselsInPort/${encodeURIComponent(searchParams.port)}`;
      }

      const url = buildUrl(path, query);
      setDebugUrl(url);
      console.log("Fetching URL:", url);
      const response = await axios.get(url);

      if (searchType === 'search') {
        setSearchResults(response.data);
        if (!response.data.length) setError("No vessels found");
      } else {
        // Recenter map based on search type
        if (searchType === 'nearMe') {
          setCenter({ lat: searchParams.lat, lon: searchParams.lon });
        } else if (searchType === 'area') {
          const midLat = (searchParams.minLat + searchParams.maxLat) / 2;
          const midLon = (searchParams.minLon + searchParams.maxLon) / 2;
          setCenter({ lat: midLat, lon: midLon });
        }

        if (Array.isArray(response.data)) {
          const nextShips = response.data.filter(
            (ship: Ship) => Number.isFinite(ship.lat) && Number.isFinite(ship.lon)
          );
          setShips(nextShips);
          if (!nextShips.length) {
            setError('No ships returned. Try narrowing the area to save API credits.');
          }
        } else if (response.data?.data) {
          const nextShips = Array.isArray(response.data.data)
            ? response.data.data.filter(
                (ship: Ship) => Number.isFinite(ship.lat) && Number.isFinite(ship.lon)
              )
            : [];
          setShips(nextShips);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch ship data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Removed auto-refresh to prevent Cloudflare blocking
  // useEffect(() => {
  //   fetchShips();
  //   const interval = setInterval(fetchShips, 60000);
  //   return () => clearInterval(interval);
  // }, []);

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapContainer center={[36.14, -5.35]} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {center && <MapRecenter lat={center.lat} lon={center.lon} zoom={10} />}
        {track.length > 0 && <TrackFitter track={track} />}
        {track.length > 0 && <Polyline key={`track-${track.length}`} positions={track} pathOptions={{ color: 'red', weight: 4, opacity: 0.7 }} />}
        {headingLine.length > 0 && <Polyline key="heading" positions={headingLine} pathOptions={{ color: 'orange', weight: 3, dashArray: '10, 10' }} />}
        {destinationPath.length > 0 && <Polyline key="dest" positions={destinationPath} pathOptions={{ color: 'purple', weight: 2, dashArray: '5, 10' }} />}
        {ships.map((ship) => {
          // Color based on whale risk
          let markerColor = 'blue';
          if (ship.whaleRisk) {
            if (ship.whaleRisk.risk_level === 'HIGH') markerColor = 'red';
            else if (ship.whaleRisk.risk_level === 'MEDIUM') markerColor = 'orange';
            else markerColor = 'green';
          }
          
          return (
          <CircleMarker 
              key={ship.id} 
              center={[ship.lat, ship.lon]}
              radius={8}
              pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: 0.8 }}
          >
            <Popup>
              <div>
                {ship.whaleRisk && (
                  <div style={{ 
                    padding: '10px', 
                    marginBottom: '10px', 
                    background: ship.whaleRisk.risk_level === 'HIGH' ? '#ffebee' : 
                               ship.whaleRisk.risk_level === 'MEDIUM' ? '#fff3e0' : '#e8f5e9',
                    border: `2px solid ${ship.whaleRisk.risk_level === 'HIGH' ? '#f44336' : 
                                        ship.whaleRisk.risk_level === 'MEDIUM' ? '#ff9800' : '#4caf50'}`,
                    borderRadius: '5px'
                  }}>
                    <strong style={{ fontSize: '1.1em' }}>🐳 Whale Risk: {ship.whaleRisk.risk_level}</strong>
                    <p style={{ margin: '5px 0' }}>Probability: {(ship.whaleRisk.probability * 100).toFixed(1)}%</p>
                    <p style={{ margin: '5px 0', fontSize: '0.9em', fontStyle: 'italic' }}>{ship.whaleRisk.recommendation}</p>
                  </div>
                )}
                
                <h3>{ship.name}</h3>
                <p><strong>Last position:</strong> {ship.timestamp ? new Date(ship.timestamp).toLocaleString() : 'Unknown'}</p>
                <p><strong>Type:</strong> {ship.type || '—'}</p>
                <p><strong>Speed:</strong> {ship.speed?.toFixed(1) ?? '—'} knots</p>
                {ship.nav_status && <p><strong>Status:</strong> {ship.nav_status}</p>}
                {ship.destination && <p><strong>Destination:</strong> {ship.destination}</p>}
                {ship.port_current && <p><strong>Port:</strong> {ship.port_current}</p>}
                <p><strong>Coordinates:</strong> {ship.lat.toFixed(4)}, {ship.lon.toFixed(4)}</p>
                <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '5px' }}>
                  <label style={{ fontSize: '0.8em', display: 'block', marginBottom: '3px' }}>Show Track History:</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => fetchTrack(ship.mmsi, 1)} style={{ cursor: 'pointer', fontSize: '0.8em' }}>24h</button>
                    <button onClick={() => fetchTrack(ship.mmsi, 3)} style={{ cursor: 'pointer', fontSize: '0.8em' }}>3 Days</button>
                    <button onClick={() => fetchTrack(ship.mmsi, 7)} style={{ cursor: 'pointer', fontSize: '0.8em' }}>7 Days</button>
                  </div>
                  <small style={{ fontSize: '0.7em', color: '#666', display: 'block', marginTop: '3px' }}>
                    Note: "Destination" is just a plan. "Track" shows actual movement.
                  </small>
                  <button onClick={() => showProjectedRoute(ship)} style={{ marginTop: '5px', cursor: 'pointer', width: '100%', background: '#e8f4f8', border: '1px solid #bde0e8' }}>
                    Show Projected Route
                  </button>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
        })}
      </MapContainer>
      
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'white', padding: 15, borderRadius: 5, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>Ship Finder</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#2c3e50' }}>
            <input 
              type="radio" 
              value="search" 
              checked={searchType === 'search'} 
              onChange={() => setSearchType('search')} 
            /> Single Ship Search (Best Value)
          </label>
          
          <div style={{ marginLeft: '20px', fontSize: '0.9em', color: '#666' }}>
            <label style={{ marginRight: '10px' }}>
              <input 
                type="radio" 
                value="nearMe" 
                checked={searchType === 'nearMe'} 
                onChange={() => setSearchType('nearMe')} 
              /> Near Me
            </label>
            <label style={{ marginRight: '10px' }}>
              <input 
                type="radio" 
                value="port" 
                checked={searchType === 'port'} 
                onChange={() => setSearchType('port')} 
              /> Port
            </label>
             <label>
              <input 
                type="radio" 
                value="area" 
                checked={searchType === 'area'} 
                onChange={() => setSearchType('area')} 
              /> Area
            </label>
          </div>
        </div>

        {searchType === 'search' && (
          <>
            <input 
              type="text" 
              placeholder="Vessel Name (min 3 chars)" 
              value={searchParams.name} 
              onChange={(e) => setSearchParams({...searchParams, name: e.target.value})}
              style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
            />
            <small style={{ color: '#28a745', display: 'block', marginTop: '5px' }}>
              Costs only 1 credit per search!
            </small>
          </>
        )}

        {searchType === 'nearMe' && (
          <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
            <p style={{ fontSize: '0.8em', color: '#e67e22', margin: '0 0 10px 0' }}>
              <strong>Warning:</strong> Costs 1 credit per ship found. Keep distance small!
            </p>
            
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }}>Latitude (e.g. 36.14)</label>
              <input 
                type="number" 
                value={searchParams.lat} 
                onChange={(e) => setSearchParams({...searchParams, lat: toNumber(e.target.value, 0)})}
                style={{ padding: '5px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }}>Longitude (e.g. -5.35)</label>
              <input 
                type="number" 
                value={searchParams.lon} 
                onChange={(e) => setSearchParams({...searchParams, lon: toNumber(e.target.value, 0)})}
                style={{ padding: '5px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }}>Radius (Nautical Miles)</label>
              <input 
                type="number" 
                value={searchParams.distance} 
                onChange={(e) => setSearchParams({...searchParams, distance: toNumber(e.target.value, 10)})}
                style={{ padding: '5px', width: '100%', boxSizing: 'border-box' }}
              />
              <small style={{ color: '#666', fontSize: '0.7em' }}>Larger radius = More ships = More credits</small>
            </div>
          </div>
        )}

        {searchType === 'port' && (
          <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
             <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }}>Port Name / LOCODE</label>
              <input 
                type="text" 
                placeholder="e.g. Hamburg" 
                value={searchParams.port} 
                onChange={(e) => setSearchParams({...searchParams, port: e.target.value})}
                style={{ padding: '5px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        {searchType === 'area' && (
          <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
            <p style={{ fontSize: '0.8em', color: '#c0392b', margin: '0 0 10px 0' }}>
              <strong>High Cost Alert:</strong> Large areas can return 500+ ships (500+ credits). Use with caution.
            </p>
            <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '5px' }}>Latitude Range</label>
            <div style={{display: 'flex', gap: '5px', marginBottom: '10px'}}>
              <input type="number" placeholder="Min" value={searchParams.minLat} onChange={(e) => setSearchParams({...searchParams, minLat: toNumber(e.target.value, 0)})} style={{width: '50%', padding: '5px'}} />
              <input type="number" placeholder="Max" value={searchParams.maxLat} onChange={(e) => setSearchParams({...searchParams, maxLat: toNumber(e.target.value, 0)})} style={{width: '50%', padding: '5px'}} />
            </div>
            
            <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '5px' }}>Longitude Range</label>
            <div style={{display: 'flex', gap: '5px'}}>
              <input type="number" placeholder="Min" value={searchParams.minLon} onChange={(e) => setSearchParams({...searchParams, minLon: toNumber(e.target.value, 0)})} style={{width: '50%', padding: '5px'}} />
              <input type="number" placeholder="Max" value={searchParams.maxLon} onChange={(e) => setSearchParams({...searchParams, maxLon: toNumber(e.target.value, 0)})} style={{width: '50%', padding: '5px'}} />
            </div>
          </div>
        )}

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }}>Max Age (Minutes)</label>
          <input 
            type="number" 
            value={searchParams.minutesBack} 
            onChange={(e) => setSearchParams({...searchParams, minutesBack: toNumber(e.target.value, 60)})}
            style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }}
          />
          <small style={{ color: '#666', fontSize: '0.7em' }}>Only show ships seen in the last X minutes.</small>
        </div>

        <button onClick={fetchShips} disabled={loading} style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          {loading ? 'Loading...' : searchType === 'search' ? 'Search Vessels' : 'Find Ships'}
        </button>

        {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
        
        {searchType === 'search' && searchResults.length > 0 && (
          <div style={{ marginTop: '10px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
            <h4>Results ({searchResults.length})</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {searchResults.map((result) => (
                <li key={result.mmsi} style={{ padding: '5px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{result.vessel_name}</strong><br/>
                    <small>{result.vessel_type} ({result.flag})</small>
                  </div>
                  <button onClick={() => locateShip(result.mmsi)} style={{ fontSize: '0.8em', padding: '2px 5px' }}>
                    Locate
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && !error && ships.length > 0 && searchType !== 'search' && (
          <div style={{ marginTop: '10px' }}>
            <p>Plotted: {ships.length} ships</p>
          </div>
        )}
        
        {debugUrl && <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#666', wordBreak: 'break-all' }}>Last URL: {debugUrl}</div>}
      </div>
    </div>
  );
};

export default ShipMap;
