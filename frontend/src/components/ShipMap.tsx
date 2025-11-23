import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import html2canvas from 'html2canvas';
import clsx from 'classnames';
import { marked } from 'marked';
import L from 'leaflet';
import { FiAlertTriangle, FiCompass, FiRefreshCcw, FiNavigation, FiShield } from 'react-icons/fi';
import 'leaflet/dist/leaflet.css';

interface WhaleRisk {
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  probability: number;
  recommendation: string;
}

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

interface SearchResult {
  vessel_name: string;
  mmsi: number;
  imo?: number;
  vtype: number;
  vessel_type: string;
  flag: string;
  area: string;
}

interface GeminiInsight {
  headline: string;
  summary: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? 'http://localhost:5001';

const MapRecenter = ({ lat, lon, zoom }: { lat: number; lon: number; zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom ?? map.getZoom());
  }, [lat, lon, zoom, map]);
  return null;
};

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
  const [trackCoords, setTrackCoords] = useState<[number, number][]>([]);
  const [trackMeta, setTrackMeta] = useState<any[]>([]);
  const [destinationPath, setDestinationPath] = useState<[number, number][]>([]);
  const [headingLine, setHeadingLine] = useState<[number, number][]>([]);
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'area' | 'nearMe' | 'port' | 'search'>('search');
  const [searchParams, setSearchParams] = useState({
    lat: 36.14,
    lon: -5.35,
    distance: 5,
    minLat: 36.5,
    maxLat: 38.5,
    minLon: -124,
    maxLon: -121,
    minutesBack: 60,
    port: 'Hamburg',
    name: ''
  });
  const [debugUrl, setDebugUrl] = useState<string>('');
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [aiInsight, setAiInsight] = useState<GeminiInsight | null>(null);
  const [insightQuestion, setInsightQuestion] = useState('What should the bridge team know for the next 24 hours?');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
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

  const calculateDestination = (lat: number, lon: number, distanceNm: number, bearing: number): [number, number] => {
    const R = 6371e3;
    const d = distanceNm * 1852;
    const φ1 = (lat * Math.PI) / 180;
    const λ1 = (lon * Math.PI) / 180;
    const θ = (bearing * Math.PI) / 180;

    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(d / R) + Math.cos(φ1) * Math.sin(d / R) * Math.cos(θ)
    );
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(d / R) * Math.cos(φ1),
        Math.cos(d / R) - Math.sin(φ1) * Math.sin(φ2)
      );

    return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
  };

  const normalizeShip = (raw: any, index: number): Ship => {
    const lat = Number(raw.lat ?? raw.latitude ?? raw.position?.lat ?? 0);
    const lon = Number(raw.lon ?? raw.lng ?? raw.longitude ?? raw.position?.lon ?? 0);

    return {
      name: raw.vessel_name ?? raw.name ?? raw.callsign ?? `Vessel ${index + 1}`,
      id: String(raw.mmsi ?? raw.imo ?? raw.id ?? `ship-${index}`),
      lat,
      lon,
      timestamp: raw.received ?? raw.time ?? raw.timestamp ?? new Date().toISOString(),
      mmsi: String(raw.mmsi ?? ''),
      imo: String(raw.imo ?? ''),
      callsign: raw.callsign,
      speed: typeof raw.speed === 'number' ? raw.speed : Number(raw.speed ?? 0) || undefined,
      area: raw.area,
      type: raw.vessel_type ?? raw.type,
      country: raw.flag ?? raw.country,
      destination: raw.destination,
      port_current: raw.current_port,
      port_next: raw.next_port,
      course: typeof raw.course === 'number' ? raw.course : Number(raw.course ?? 0) || undefined,
      nav_status: raw.nav_status,
      source: raw.source ?? raw.source_type,
      whaleRisk: raw.whaleRisk,
    };
  };

  const captureMapSnapshot = async () => {
    if (!mapWrapperRef.current) return undefined;
    const canvas = await html2canvas(mapWrapperRef.current, {
      useCORS: true,
      logging: false,
      backgroundColor: '#030711'
    });
    return {
      mimeType: 'image/png',
      dataUrl: canvas.toDataURL('image/png')
    };
  };

  const getWhaleRisk = async (lat: number, lon: number): Promise<WhaleRisk | undefined> => {
    try {
      const response = await axios.post(buildUrl('/api/whale-risk'), {
        latitude: lat,
        longitude: lon
      });
      return response.data;
    } catch (e) {
      console.error('Failed to get whale risk:', e);
      return undefined;
    }
  };

  const showProjectedRoute = async (ship: Ship) => {
    setHeadingLine([]);
    setDestinationPath([]);

    try {
      if (ship.course) {
        const endPoint = calculateDestination(ship.lat, ship.lon, 50, ship.course);
        setHeadingLine([[ship.lat, ship.lon], endPoint]);
      }

      if (ship.destination && ship.destination.length > 2) {
        const query = encodeURIComponent(ship.destination);
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`
        );

        if (Array.isArray(response.data) && response.data.length) {
          const destLat = Number(response.data[0].lat);
          const destLon = Number(response.data[0].lon);
          setDestinationPath([
            [ship.lat, ship.lon],
            [destLat, destLon]
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to project route', err);
    }
  };

  const fetchTrack = async (mmsi: string, days: number = 1) => {
    setLoading(true);
    try {
      const url = buildUrl(`/api/vessels/track/${mmsi}`, { days });
      const response = await axios.get(url);

      if (Array.isArray(response.data) && response.data.length > 0) {
        const coords = response.data.map((p: any) => [p.lat, p.lng] as [number, number]);
        setTrackCoords(coords);
        setTrackMeta(response.data);

        const ship = ships.find((s) => s.mmsi === mmsi);
        if (ship && ship.course) {
          const endPoint = calculateDestination(ship.lat, ship.lon, 50, ship.course);
          setHeadingLine([[ship.lat, ship.lon], endPoint]);
        }
      } else {
        setTrackCoords([]);
        setTrackMeta([]);
        setError(`No track history found for the last ${days} day(s).`);
      }
    } catch (err) {
      console.error('Failed to fetch track', err);
      setError('Failed to load track data.');
    } finally {
      setLoading(false);
    }
  };

  const locateShip = async (mmsi: number) => {
    setLoading(true);
    try {
      const url = buildUrl(`/api/vessels/status/${mmsi}`);
      const response = await axios.get(url);

      if (response.data?.lat && response.data?.lng) {
        const whaleRisk = await getWhaleRisk(response.data.lat, response.data.lng);
        const normalized = normalizeShip({ ...response.data, whaleRisk }, 0);
        setShips([normalized]);
        setSelectedShip(normalized);
        setCenter({ lat: normalized.lat, lon: normalized.lon });
        setTrackCoords([]);
        setTrackMeta([]);
      }
    } catch (err) {
      console.error('Failed to locate vessel', err);
      setError('Unable to locate vessel.');
    } finally {
      setLoading(false);
    }
  };

  const fetchShips = async () => {
    setLoading(true);
    setError(null);
    setDestinationPath([]);
    setHeadingLine([]);

    try {
      let path = '';
      let query: Record<string, string | number | undefined> | undefined;

      if (searchType === 'search') {
        if (searchParams.name.trim().length < 3) {
          setError('Search term must be at least 3 characters.');
          setLoading(false);
          return;
        }
        path = `/api/vessels/search/${encodeURIComponent(searchParams.name.trim())}`;
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
      const response = await axios.get(url);

      if (searchType === 'search') {
        setSearchResults(response.data ?? []);
        if ((response.data ?? []).length === 0) {
          setError('No vessels found');
        }
        return;
      }

      if (searchType === 'nearMe') {
        setCenter({ lat: searchParams.lat, lon: searchParams.lon });
      } else if (searchType === 'area') {
        const midLat = (searchParams.minLat + searchParams.maxLat) / 2;
        const midLon = (searchParams.minLon + searchParams.maxLon) / 2;
        setCenter({ lat: midLat, lon: midLon });
      }

      const rows = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];

      const normalized = rows
        .map((row: any, index: number) => normalizeShip(row, index))
        .filter((ship: Ship) => Number.isFinite(ship.lat) && Number.isFinite(ship.lon));

      setShips(normalized);
      setSelectedShip(normalized[0] ?? null);

      if (!normalized.length) {
        setError('No ships returned. Try narrowing the area.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch ship data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const requestGeminiInsight = async () => {
    if (!selectedShip) {
      setAiError('Select a vessel first.');
      return;
    }
    setAiLoading(true);
    setAiError(null);

    try {
      const mapSnapshot = await captureMapSnapshot();
      const payload = {
        ship: {
          name: selectedShip.name,
          mmsi: selectedShip.mmsi,
          imo: selectedShip.imo,
          lat: selectedShip.lat,
          lon: selectedShip.lon,
          speed: selectedShip.speed,
          course: selectedShip.course,
          destination: selectedShip.destination,
          nav_status: selectedShip.nav_status,
          flag: selectedShip.country,
          whaleRisk: selectedShip.whaleRisk
        },
        track: trackMeta,
        question: insightQuestion,
        mapSnapshot
      };

      const response = await axios.post(buildUrl('/api/gemini/insight'), payload);
      setAiInsight(response.data);
    } catch (err) {
      console.error('Gemini insight failed', err);
      setAiError('Gemini insight failed. Check API key or usage limits.');
    } finally {
      setAiLoading(false);
    }
  };

  const stats = useMemo(() => {
    const highRisk = ships.filter((ship) => ship.whaleRisk?.risk_level === 'HIGH').length;
    return [
      { label: 'Ships Monitored', value: ships.length || '—', icon: <FiCompass /> },
      { label: 'High Whale Alerts', value: highRisk || '0', icon: <FiAlertTriangle /> },
      {
        label: 'Last Sync',
        value: selectedShip?.timestamp ? new Date(selectedShip.timestamp).toLocaleTimeString() : 'Awaiting data',
        icon: <FiRefreshCcw />
      }
    ];
  }, [ships, selectedShip]);

  const renderMarkdown = (text: string) => {
    const html = marked.parse(text, { breaks: true });
    return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Whale Guardian Operations Center</p>
          <h1>Live Vessel Intelligence + AI Cetacean Safety</h1>
          <p className="hero-copy">
            Blend AIS telemetry, whale habitat modeling, and Gemini multimodal insights to brief bridge teams before they enter
            sensitive waters.
          </p>
        </div>
        <div className="hero-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="stat-icon">{stat.icon}</div>
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-body">
        <div className="map-wrapper" ref={mapWrapperRef}>
          <MapContainer center={[36.14, -5.35]} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {center && <MapRecenter lat={center.lat} lon={center.lon} zoom={6} />}
            {trackCoords.length > 0 && <TrackFitter track={trackCoords} />}
            {trackCoords.length > 0 && (
              <Polyline positions={trackCoords} pathOptions={{ color: '#ff6b6b', weight: 4, opacity: 0.8 }} />
            )}
            {headingLine.length > 0 && (
              <Polyline positions={headingLine} pathOptions={{ color: '#f3a712', weight: 3, dashArray: '12 8' }}>
                <Popup>Projected heading (50nm)</Popup>
              </Polyline>
            )}
            {destinationPath.length > 0 && (
              <Polyline positions={destinationPath} pathOptions={{ color: '#a78bfa', weight: 2, dashArray: '6 12' }}>
                <Popup>Projected route to reported destination</Popup>
              </Polyline>
            )}
            {ships.map((ship) => {
              const risk = ship.whaleRisk?.risk_level ?? 'LOW';
              const markerColor =
                risk === 'HIGH' ? '#ff5c8d' : risk === 'MEDIUM' ? '#ffc857' : '#2dd4bf';
              const isSelected = selectedShip?.id === ship.id;

              return (
                <CircleMarker
                  key={ship.id}
                  center={[ship.lat, ship.lon]}
                  radius={isSelected ? 11 : 8}
                  pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: 0.85 }}
                  eventHandlers={{
                    click: () => setSelectedShip(ship)
                  }}
                >
                  <Popup>
                    <div className="popup-card">
                      <p className="popup-title">{ship.name}</p>
                      <p className="popup-meta">{ship.mmsi ? `MMSI ${ship.mmsi}` : 'Unknown MMSI'}</p>
                      {ship.whaleRisk && (
                        <p className={`chip risk-${ship.whaleRisk.risk_level.toLowerCase()}`}>
                          🐳 Whale Risk: {ship.whaleRisk.risk_level} •{' '}
                          {(ship.whaleRisk.probability * 100).toFixed(1)}%
                        </p>
                      )}
                      <p className="popup-field">
                        <span>Speed</span>
                        <strong>{ship.speed?.toFixed(1) ?? '—'} kn</strong>
                      </p>
                      <p className="popup-field">
                        <span>Status</span>
                        <strong>{ship.nav_status ?? 'Unknown'}</strong>
                      </p>
                      {ship.destination && (
                        <p className="popup-field">
                          <span>Destination</span>
                          <strong>{ship.destination}</strong>
                        </p>
                      )}
                      <div className="popup-actions">
                        <button onClick={() => fetchTrack(ship.mmsi, 1)}>24h</button>
                        <button onClick={() => fetchTrack(ship.mmsi, 3)}>3d</button>
                        <button onClick={() => fetchTrack(ship.mmsi, 7)}>7d</button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          <div className="map-overlay">
            <div>
              <p className="overlay-title">Layers</p>
              <p>Red = historical wake, orange = projected heading, violet = destination corridor.</p>
            </div>
          </div>
        </div>

        <aside className="sidebar">
          <div className="panel-section">
            <div className="section-header">
              <h3>Mission Console</h3>
              <button className="ghost-btn" onClick={fetchShips} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            <div className="radio-grid">
              {(['search', 'nearMe', 'port', 'area'] as const).map((mode) => (
                <label key={mode} className={clsx('radio-pill', { active: searchType === mode })}>
                  <input
                    type="radio"
                    value={mode}
                    checked={searchType === mode}
                    onChange={() => setSearchType(mode)}
                  />
                  {mode === 'search' ? 'Single Ship' : mode === 'nearMe' ? 'Near Me' : mode === 'port' ? 'Port' : 'Area'}
                </label>
              ))}
            </div>

            {searchType === 'search' && (
              <div className="control-group">
                <label>Vessel Name</label>
                <input
                  type="text"
                  value={searchParams.name}
                  onChange={(e) => setSearchParams({ ...searchParams, name: e.target.value })}
                  placeholder="e.g. EVER GIVEN"
                />
                <small>Only 1 credit per search</small>
              </div>
            )}

            {searchType === 'nearMe' && (
              <div className="control-grid">
                <div>
                  <label>Latitude</label>
                  <input
                    type="number"
                    value={searchParams.lat}
                    onChange={(e) => setSearchParams({ ...searchParams, lat: toNumber(e.target.value, 0) })}
                  />
                </div>
                <div>
                  <label>Longitude</label>
                  <input
                    type="number"
                    value={searchParams.lon}
                    onChange={(e) => setSearchParams({ ...searchParams, lon: toNumber(e.target.value, 0) })}
                  />
                </div>
                <div>
                  <label>Radius (nm)</label>
                  <input
                    type="number"
                    value={searchParams.distance}
                    onChange={(e) => setSearchParams({ ...searchParams, distance: toNumber(e.target.value, 5) })}
                  />
                </div>
              </div>
            )}

            {searchType === 'port' && (
              <div className="control-group">
                <label>Port / LOCODE</label>
                <input
                  type="text"
                  value={searchParams.port}
                  onChange={(e) => setSearchParams({ ...searchParams, port: e.target.value })}
                  placeholder="Hamburg or DEHAM"
                />
              </div>
            )}

            {searchType === 'area' && (
              <div className="control-grid">
                <div>
                  <label>Min Lat</label>
                  <input
                    type="number"
                    value={searchParams.minLat}
                    onChange={(e) => setSearchParams({ ...searchParams, minLat: toNumber(e.target.value, 0) })}
                  />
                </div>
                <div>
                  <label>Max Lat</label>
                  <input
                    type="number"
                    value={searchParams.maxLat}
                    onChange={(e) => setSearchParams({ ...searchParams, maxLat: toNumber(e.target.value, 0) })}
                  />
                </div>
                <div>
                  <label>Min Lon</label>
                  <input
                    type="number"
                    value={searchParams.minLon}
                    onChange={(e) => setSearchParams({ ...searchParams, minLon: toNumber(e.target.value, 0) })}
                  />
                </div>
                <div>
                  <label>Max Lon</label>
                  <input
                    type="number"
                    value={searchParams.maxLon}
                    onChange={(e) => setSearchParams({ ...searchParams, maxLon: toNumber(e.target.value, 0) })}
                  />
                </div>
              </div>
            )}

            <div className="control-group">
              <label>Report Age (minutes)</label>
              <input
                type="number"
                value={searchParams.minutesBack}
                onChange={(e) => setSearchParams({ ...searchParams, minutesBack: toNumber(e.target.value, 60) })}
              />
            </div>
          </div>

          {searchType === 'search' && searchResults.length > 0 && (
            <div className="panel-section">
              <h3>Candidate Vessels</h3>
              <ul className="result-list">
                {searchResults.map((result) => (
                  <li key={result.mmsi}>
                    <div>
                      <strong>{result.vessel_name}</strong>
                      <span>{result.vessel_type} · {result.flag}</span>
                    </div>
                    <button onClick={() => locateShip(result.mmsi)}>Locate</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedShip && (
            <div className="panel-section selected-card">
              <div className="section-header">
                <h3>Selected Vessel</h3>
                <span className="chip">
                  <FiNavigation /> {selectedShip.destination ?? 'No destination filed'}
                </span>
              </div>
              <h2>{selectedShip.name}</h2>
              <p className="selected-meta">MMSI {selectedShip.mmsi}{selectedShip.country ? ` · ${selectedShip.country}` : ''}</p>
              {selectedShip.whaleRisk && (
                <p className={clsx('chip', `risk-${selectedShip.whaleRisk.risk_level.toLowerCase()}`)}>
                  🐳 {selectedShip.whaleRisk.risk_level} risk · {(selectedShip.whaleRisk.probability * 100).toFixed(1)}%
                </p>
              )}
              <div className="selected-grid">
                <div>
                  <p>Speed</p>
                  <strong>{selectedShip.speed?.toFixed(1) ?? '—'} kn</strong>
                </div>
                <div>
                  <p>Course</p>
                  <strong>{selectedShip.course ?? '—'}°</strong>
                </div>
                <div>
                  <p>Status</p>
                  <strong>{selectedShip.nav_status ?? 'Unknown'}</strong>
                </div>
                <div>
                  <p>Updated</p>
                  <strong>{new Date(selectedShip.timestamp).toLocaleTimeString()}</strong>
                </div>
              </div>
              <div className="button-row">
                <button onClick={() => fetchTrack(selectedShip.mmsi, 1)}>24h Track</button>
                <button onClick={() => fetchTrack(selectedShip.mmsi, 3)}>3d Track</button>
                <button onClick={() => showProjectedRoute(selectedShip)}>Project Route</button>
              </div>
            </div>
          )}

          <div className="panel-section ai-panel">
            <div className="section-header">
              <h3>Gemini Safety Briefing</h3>
              <span className="chip ghost">
                <FiShield /> Multimodal
              </span>
            </div>
            <textarea
              value={insightQuestion}
              onChange={(e) => setInsightQuestion(e.target.value)}
              rows={3}
              placeholder="Prompt Gemini..."
            />
            <button className="primary-btn" onClick={requestGeminiInsight} disabled={aiLoading || !selectedShip}>
              {aiLoading ? 'Analyzing chart…' : 'Generate Briefing'}
            </button>
            {aiError && <p className="error-text">{aiError}</p>}
            {aiInsight && (
              <div className="insight-output">
                {renderMarkdown(aiInsight.summary)}
              </div>
            )}
          </div>

          {error && <div className="panel-section error-card">{error}</div>}

          {debugUrl && (
            <div className="panel-section">
              <p className="debug-label">Last API Call</p>
              <code>{debugUrl}</code>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};

export default ShipMap;
