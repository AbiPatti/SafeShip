import Source from "../Source";
import { mstClient } from "../../../services/mstClient";

class MyShipTracking extends Source {
  getLocation = async (mmsi: number) => {
    const status = await mstClient.getVesselStatus({ mmsi });
    const position = {
      lat: status.lat,
      lon: status.lng,
      course: status.course ?? null,
      speed: status.speed ?? null,
      timestamp: status.received,
      source: "myshiptracking.com",
      source_type: "AIS",
    };
    this.verifyPosition(position);
    return position;
  };
}

export default MyShipTracking;
