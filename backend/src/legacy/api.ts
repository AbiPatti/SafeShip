import Marinetraffic from "../classes/sources/ais/mt";
import MyShipTracking from "../classes/sources/ais/mst";
import { mstClient } from "../services/mstClient";
import { mapZoneVesselToShip, ShipSummary } from "../utils/shipTransform";

const moment = require("moment");

const debug = (...args) => {
  if (true) {
    console.log.apply(console, args);
  }
};

const MAX_PORT_VESSELS = Number(process.env.MST_MAX_PORT_VESSELS ?? 40);

async function getLocationFromVF(mmsi, cb) {
  await getLocationFromMST(mmsi, cb);
}

async function getLocationFromMST(mmsi, cb) {
  const mst = new MyShipTracking();
  try {
    const location = await mst.getLocation(mmsi);
    console.log(location);
    cb({
      error: null,
      data: location,
    });
  } catch (e) {
    cb({
      error: e,
      data: null,
    });
  }
}

async function getLocationFromMT(mmsi, cb) {
  const mt = new Marinetraffic();

  try {
    const location = await mt.getLocation(mmsi);
    console.log(location);
    cb({
      error: null,
      data: location,
    });
  } catch (e) {
    cb({
      error: e,
      data: null,
    });
  }
}

function getLocation(mmsi, cb) {
  debug("getting location for vessel: ", mmsi);
  getLocationFromVF(mmsi, function (VFResult) {
    debug("got location from vf", VFResult);

    getLocationFromMT(mmsi, function (MTResult) {
      if (MTResult.error) {
        cb(VFResult);
      } else {
        debug("got location from mt", MTResult);
        if (!VFResult.data) {
          return cb(MTResult);
        }
        const vfDate = moment(VFResult.data.timestamp);
        const mtDate = moment(MTResult.data.timestamp);
        const secondsDiff = mtDate.diff(vfDate, "seconds");
        debug("time diff in seconds: ", secondsDiff);

        cb(secondsDiff > 0 ? MTResult : VFResult);
      }
    });
  });
}

function getVesselsInPort(shipPort, cb) {
  resolvePortIdentifier(shipPort)
    .then(async (portReference) => {
      if (!portReference) {
        cb([]);
        return;
      }

      const vesselsInPort = await mstClient.getVesselsInPort(portReference);
      const withMmsi = vesselsInPort
        .filter((vessel) => vessel.mmsi)
        .slice(0, MAX_PORT_VESSELS);

      if (!withMmsi.length) {
        cb([]);
        return;
      }

      const mmsiList = withMmsi.map((vessel) => String(vessel.mmsi));
      const statuses = await mstClient.getBulkVesselStatus({ mmsi: mmsiList });
      const statusMap = new Map<string, ShipSummary>();
      statuses.forEach((status) => {
        if (status.mmsi) {
          statusMap.set(String(status.mmsi), mapZoneVesselToShip(status));
        }
      });

      const merged = withMmsi
        .map((vessel) => {
          const key = vessel.mmsi ? String(vessel.mmsi) : null;
          if (!key) {
            return null;
          }
          const base = statusMap.get(key);
          if (!base) {
            return null;
          }
          return {
            ...base,
            type: vessel.vessel_type ?? base.type,
            country: vessel.flag ?? base.country,
            destination: base.destination,
            port_current: portReference.name ?? base.port_current,
          };
        })
        .filter((ship): ship is ShipSummary => Boolean(ship));

      cb(merged);
    })
    .catch((error) => {
      debug("getVesselsInPort failed", error?.message ?? error);
      cb([]);
    });
}

async function resolvePortIdentifier(
  rawInput?: string,
): Promise<{ portId?: number; unloco?: string; name?: string } | null> {
  if (!rawInput) {
    return null;
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return { portId: Number(trimmed), name: trimmed };
  }

  if (/^[A-Za-z]{5}$/.test(trimmed)) {
    return { unloco: trimmed.toUpperCase(), name: trimmed.toUpperCase() };
  }

  const matches = await mstClient.searchPorts(trimmed);
  if (!matches.length) {
    return null;
  }

  const match = matches[0];
  return {
    portId: match.port_id,
    unloco: match.unloco,
    name: match.name,
  };
}

export class api {
  static getLocationFromVF = getLocationFromVF;
  static getLocationFromMT = getLocationFromMT;
  static getLocationFromMST = getLocationFromMST;
  static getLocation = getLocation;
  static getVesselsInPort = getVesselsInPort;
}
