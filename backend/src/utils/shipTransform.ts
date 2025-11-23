import { MstPortVessel, MstZoneVessel } from "../services/mstClient";

export interface ShipSummary {
  name: string;
  id: string;
  lat: number;
  lon: number;
  timestamp: string;
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
  course?: number | null;
  nav_status?: string | null;
  source: string;
}

const buildShipId = (
  mmsi?: number | null,
  imo?: number | null,
  name = "",
  timestamp = "",
) => {
  if (mmsi) return String(mmsi);
  if (imo) return String(imo);
  const fallback = [name, timestamp].filter(Boolean).join("-");
  return fallback || `ship-${Date.now()}`;
};

export const mapZoneVesselToShip = (vessel: MstZoneVessel): ShipSummary => {
  return {
    name: vessel.vessel_name,
    id: buildShipId(vessel.mmsi, vessel.imo, vessel.vessel_name, vessel.received),
    lat: vessel.lat,
    lon: vessel.lng,
    timestamp: vessel.received,
    mmsi: vessel.mmsi ? String(vessel.mmsi) : "",
    imo: vessel.imo ? String(vessel.imo) : "",
    callsign: "",
    speed: vessel.speed ?? 0,
    area: "",
    type: vessel.vtype ? String(vessel.vtype) : "",
    country: "",
    destination: "",
    port_current: "",
    port_next: "",
    course: vessel.course ?? null,
    nav_status: vessel.nav_status ?? null,
    source: "myshiptracking.com",
  };
};

export const mapPortVesselToShip = (vessel: MstPortVessel): ShipSummary => {
  return {
    name: vessel.name,
    id: buildShipId(vessel.mmsi, vessel.imo, vessel.name, vessel.arrived ?? ""),
    lat: NaN,
    lon: NaN,
    timestamp: vessel.arrived ?? "",
    mmsi: vessel.mmsi ? String(vessel.mmsi) : "",
    imo: vessel.imo ? String(vessel.imo) : "",
    callsign: "",
    speed: 0,
    area: "",
    type: vessel.vessel_type ?? (vessel.vtype ? String(vessel.vtype) : ""),
    country: vessel.flag ?? "",
    destination: "",
    port_current: "",
    port_next: "",
    course: null,
    nav_status: null,
    source: "myshiptracking.com",
  };
};
