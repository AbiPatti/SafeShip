import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

interface Ship {
  name: string;
  id: string;
  lat: number;
  lon: number;
  timestamp: number;
  mmsi: string;
  imo: string;
  callsign: string;
  speed: number;
  area: string;
  type: string;
  country: string;
  destination: string;
  port_current: string;
  port_next: string;
}

const ShipMap = () => {
  const [ships, setShips] = useState<Ship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'area' | 'nearMe' | 'port'>('nearMe');
  const [searchParams, setSearchParams] = useState({
    lat: 37.7749,
    lon: -122.4194,
    distance: 10,
    area: 'WMED,EMED',
    port: 'Hamburg'
  });

  const fetchShips = async () => {
    setLoading(true);
    setError(null);
    setShips([]);
    try {
      let url = '';
      if (searchType === 'area') {
        url = `http://localhost:5001/legacy/getVesselsInArea/${searchParams.area}`;
      } else if (searchType === 'nearMe') {
        url = `http://localhost:5001/legacy/getVesselsNearMe/${searchParams.lat}/${searchParams.lon}/${searchParams.distance}`;
      } else if (searchType === 'port') {
        url = `http://localhost:5001/legacy/getVesselsInPort/${searchParams.port}`;
      }

      const response = await axios.get(url);
      if (response.data) {
        const nextShips = Array.isArray(response.data) ? response.data : [];
        setShips(nextShips);
        if (!nextShips.length) {
          setError('No ships returned. The upstream service may be blocking automated requests right now.');
        }
      }
    } catch (err) {
      console.error("Error fetching ships:", err);
      setError("Failed to fetch ship data. Make sure the backend is running.");
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
      <MapContainer center={[38, 15]} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {ships.map((ship) => (
          <CircleMarker 
              key={ship.id} 
              center={[ship.lat, ship.lon]}
              radius={5}
              pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.7 }}
          >
            <Popup>
              <div>
                <h3>{ship.name}</h3>
                <p><strong>Type:</strong> {ship.type}</p>
                <p><strong>Speed:</strong> {ship.speed} knots</p>
                <p><strong>Destination:</strong> {ship.destination}</p>
                <p><strong>Coordinates:</strong> {ship.lat.toFixed(4)}, {ship.lon.toFixed(4)}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'white', padding: 15, borderRadius: 5, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
        <h3>Ship Finder</h3>
        
        <div>
          <label>
            <input 
              type="radio" 
              value="nearMe" 
              checked={searchType === 'nearMe'} 
              onChange={() => setSearchType('nearMe')} 
            /> Near Me
          </label>
          <label style={{marginLeft: '10px'}}>
            <input 
              type="radio" 
              value="port" 
              checked={searchType === 'port'} 
              onChange={() => setSearchType('port')} 
            /> Port
          </label>
           <label style={{marginLeft: '10px'}}>
            <input 
              type="radio" 
              value="area" 
              checked={searchType === 'area'} 
              onChange={() => setSearchType('area')} 
            /> Area
          </label>
        </div>

        {searchType === 'nearMe' && (
          <>
            <input 
              type="number" 
              placeholder="Lat" 
              value={searchParams.lat} 
              onChange={(e) => setSearchParams({...searchParams, lat: parseFloat(e.target.value)})}
            />
            <input 
              type="number" 
              placeholder="Lon" 
              value={searchParams.lon} 
              onChange={(e) => setSearchParams({...searchParams, lon: parseFloat(e.target.value)})}
            />
            <input 
              type="number" 
              placeholder="Distance (nm)" 
              value={searchParams.distance} 
              onChange={(e) => setSearchParams({...searchParams, distance: parseFloat(e.target.value)})}
            />
          </>
        )}

        {searchType === 'port' && (
          <input 
            type="text" 
            placeholder="Port Name (e.g. Hamburg)" 
            value={searchParams.port} 
            onChange={(e) => setSearchParams({...searchParams, port: e.target.value})}
          />
        )}

        {searchType === 'area' && (
          <input 
            type="text" 
            placeholder="Area (e.g. WMED,EMED)" 
            value={searchParams.area} 
            onChange={(e) => setSearchParams({...searchParams, area: e.target.value})}
          />
        )}

        <button onClick={fetchShips} disabled={loading}>
          {loading ? 'Searching...' : 'Find Ships'}
        </button>
        
        {error && <div style={{color: 'red', fontSize: '0.8em'}}>{error}</div>}
        <div>Found: {ships.length} ships</div>
      </div>
    </div>
  );
};

export default ShipMap;
