# AIS Data Sources & Scraping Options

## 1. Free / Open APIs (Regional)

*   **Digitraffic (Finland)**
    *   **Region**: Finland / Baltic Sea
    *   **Cost**: Free
    *   **API**: REST & MQTT (Real-time)
    *   **Docs**: [https://www.digitraffic.fi/en/marine-traffic/](https://www.digitraffic.fi/en/marine-traffic/)
    *   **Notes**: Excellent for testing, but limited coverage.

*   **BarentsWatch (Norway)**
    *   **Region**: Norway
    *   **Cost**: Free (Open Data)
    *   **Docs**: [https://www.barentswatch.no/en/open-data/](https://www.barentswatch.no/en/open-data/)

## 2. Global Aggregators (Free with Conditions)

*   **AISHub**
    *   **Region**: Global
    *   **Cost**: Free *if* you contribute data (set up an AIS receiver).
    *   **API**: JSON/XML
    *   **Docs**: [https://www.aishub.net/api](https://www.aishub.net/api)
    *   **Notes**: Best reliable free option if you can host a feeder.

## 3. Scraping Options (Unofficial)

### VesselFinder
*   **Library**: `scrape-vesselfinder` (Node.js)
*   **Usage**: Good for fetching details of a *specific* ship by MMSI/IMO.
*   **Area Search**: Not directly supported by the library. Requires reverse-engineering the map endpoint.
*   **Map Endpoint Strategy**:
    1.  Open [https://www.vesselfinder.com/](https://www.vesselfinder.com/)
    2.  Open Developer Tools (F12) -> Network Tab.
    3.  Pan/Zoom the map.
    4.  Look for XHR requests (often `api/` or `.php`).
    5.  Replicate the request with bounding box coordinates.

### MyShipTracking
*   **Library**: None found.
*   **Existing Code**: `backend/src/classes/sources/ais/mst.ts` scrapes single vessel pages.
*   **Area Search**: Similar strategy to VesselFinder. Look for requests to `requests/vessel_request.php` or similar.

## 4. Paid APIs
*   **MarineTraffic**: Extensive API, paid credits.
*   **VesselFinder**: Paid API available.
*   **Spire / ExactEarth**: Enterprise grade.

## Recommendation for "Mediterranean Area"
Since there is no free "Mediterranean" API:
1.  **Scraping**: Use the Map API reverse-engineering method (brittle, may be blocked).
2.  **AISHub**: Set up a receiver to get access to the global feed.
