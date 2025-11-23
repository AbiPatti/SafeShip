# Position API

A Node.js/TypeScript API for retrieving real-time vessel and aircraft positions. AIS data is fetched from the official MyShipTracking API (credit based), while ADS-B data is proxied from ADSBexchange.

## Features

- Fetch latest vessel positions by MMSI via MyShipTracking (official API).
- Fetch latest aircraft positions by ICAO from ADS-B Exchange.
- Credit-aware area, proximity, and port queries with bounding-box limits.
- Legacy endpoints preserved for compatibility.
- Lightweight caching layer to avoid unnecessary credit spend.

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm

### Installation

```bash
git clone https://github.com/transparency-everywhere/position-api.git
cd position-api
npm install
```

### Configuration

Copy the environment template and adjust as needed:

```bash
cp .env.template .env
```

Mandatory variables:

- `MST_API_KEY` &mdash; your MyShipTracking API key (Bearer token).

Optional credit-protection knobs:

- `MST_DEFAULT_MINUTES_BACK` (default `60`)
- `MST_MAX_LAT_SPAN` / `MST_MAX_LON_SPAN` (caps bounding boxes)
- `MST_MAX_RESULTS` (server-side cap on returned vessels)
- `MST_MAX_PORT_VESSELS` (how many vessels we enrich per port request)

### Build

```bash
npm run build
```

### Run

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## API Endpoints

### Vessel Position

- `GET /ais/mt/:mmsi/location/latest`  
  Get latest position for a vessel by MMSI.

### Aircraft Position

- `GET /adsb/adsbe/:icao/location/latest`  
  Get latest position for an aircraft by ICAO code.

### Legacy Endpoints

- `/legacy/getLastPositionFromVF/:mmsi`
- `/legacy/getLastPositionFromMT/:mmsi`
- `/legacy/getLastPosition/:mmsi`
- `/legacy/getVesselsInArea/:area`
- `/legacy/getVesselsNearMe/:lat/:lng/:distance`
- `/legacy/getVesselsInPort/:shipPort`

## Development

- Lint code: `npm run lint`
- Format code: `npm run prettier`
- Run tests: `npm test`

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[ISC](LICENSE)

---

*Powered by Node.js, Express, Puppeteer, and TypeScript.*
curl http://localhost:5000/legacy/getVesselsInArea/WMED,EMED

# Legacy: Get vessels near a location
curl http://localhost:5000/legacy/getVesselsNearMe/37.7749/-122.4194/10

# Legacy: Get vessels in port
curl http://localhost:5000/legacy/getVesselsInPort/Hamburg
```

---

## Notes

- All endpoints return JSON.
- Replace `localhost:5000` with your server's address and port if different.
- Pull requests and issues are welcome!

---

## Notes

- All endpoints return JSON.
- Replace `localhost:5000` with your server's address and port if different.
- Pull requests and issues are welcome!

---
- **Get latest location by ICAO**
  ```
  GET /adsb/adsbe/:icao/location/latest
  ```
  **Example:**
  ```
  curl http://localhost:5000/adsb/adsbe/abc123/location/latest
  ```

### Legacy Vessel Routes

- **Get last position from MST (replaces VF)**
  ```
  GET /legacy/getLastPositionFromVF/:mmsi
  ```
  **Example:**
  ```
  curl http://localhost:5000/legacy/getLastPositionFromVF/211879870
  ```

- **Get last position from Marinetraffic**
  ```
  GET /legacy/getLastPositionFromMT/:mmsi
  ```
  **Example:**
  ```
  curl http://localhost:5000/legacy/getLastPositionFromMT/211879870
  ```

- **Get last position (default)**
  ```
  GET /legacy/getLastPosition/:mmsi
  ```
  **Example:**
  ```
  curl http://localhost:5000/legacy/getLastPosition/211879870
  ```

- **Get vessels in area (MyShipTracking)**
  ```
  GET /legacy/getVesselsInArea/:areaExpression?minutesBack=45
  ```
  - Use presets (e.g. `WMED`) or bounding boxes: `bbox:minLat|minLon|maxLat|maxLon`
  - Bounding boxes wider than the configured span will be rejected to avoid runaway credit usage.
  **Examples:**
  ```bash
  # Central Mediterranean, last 45 minutes
  curl "http://localhost:5000/legacy/getVesselsInArea/bbox:36|10|41|18?minutesBack=45"
  ```

- **Get vessels near me (bounding box wrapper)**
  ```
  GET /legacy/getVesselsNearMe/:lat/:lng/:distance?minutesBack=30
  ```
  - Distance is in nautical miles (1&ndash;50). The server converts it to a small bounding box.
  **Example:**
  ```bash
  curl "http://localhost:5000/legacy/getVesselsNearMe/37.7749/-122.4194/8?minutesBack=30"
  ```

- **Get vessels in port (name, UN/LOCODE, or ID)**
  ```
  GET /legacy/getVesselsInPort/:shipPort
  ```
  - Accepts port name (`Hamburg`), UN/LOCODE (`DEHAM`), or numeric `port_id`.
  - The API resolves the port, calls `port/inport`, then enriches up to `MST_MAX_PORT_VESSELS` vessels via the bulk status endpoint so coordinates are available for the map.
  **Example:**
  ```bash
  curl http://localhost:5000/legacy/getVesselsInPort/DEHAM
  ```

## Notes

- All endpoints return JSON.
- Replace `localhost:5000` with your server's address and port if different.



