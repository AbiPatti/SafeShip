import { scrapeVessel } from 'scrape-vesselfinder';

// Example: Scrape a specific vessel by MMSI
// Costa Favolosa MMSI: 247311100
async function getVesselDetails(mmsi: string) {
    try {
        const vessel = await scrapeVessel(mmsi);
        console.log('Vessel Details:', vessel);
        return vessel;
    } catch (error) {
        console.error('Error scraping vessel:', error);
    }
}

// Example usage
getVesselDetails('247311100');

/*
 * STRATEGY FOR AREA SCRAPING (Conceptual)
 * 
 * To get a list of ships in a bounding box (e.g., Mediterranean), you typically need to 
 * mimic the requests made by the map interface of tracking sites.
 * 
 * Example (Pseudocode):
 * 
 * const axios = require('axios');
 * 
 * async function getShipsInArea(minLat, maxLat, minLon, maxLon) {
 *     // This URL is hypothetical and needs to be found via Browser DevTools -> Network Tab
 *     const mapEndpoint = 'https://www.myshiptracking.com/requests/vessel_request.php'; 
 *     
 *     const params = {
 *         type: 'json',
 *         minlat: minLat,
 *         maxlat: maxLat,
 *         minlon: minLon,
 *         maxlon: maxLon,
 *         zoom: 10 // Zoom level often affects clustering
 *     };
 * 
 *     const response = await axios.get(mapEndpoint, { 
 *         params,
 *         headers: {
 *             'User-Agent': 'Mozilla/5.0 ...', // Mimic a real browser
 *             'Referer': 'https://www.myshiptracking.com/'
 *         }
 *     });
 * 
 *     return response.data; // Usually a list of ships with lat/lon/mmsi
 * }
 */
