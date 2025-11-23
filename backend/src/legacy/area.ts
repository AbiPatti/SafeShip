import { mstClient, ZoneQuery } from "../services/mstClient";
import { mapZoneVesselToShip, ShipSummary } from "../utils/shipTransform";

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface QueryOptions {
  minutesBack?: number;
}

const DEFAULT_MINUTES_BACK = Number(process.env.MST_DEFAULT_MINUTES_BACK ?? 60);
const MAX_LAT_SPAN = Number(process.env.MST_MAX_LAT_SPAN ?? 10);
const MAX_LON_SPAN = Number(process.env.MST_MAX_LON_SPAN ?? 25);
const MAX_RESULTS = Number(process.env.MST_MAX_RESULTS ?? 200);

const AREA_PRESETS: Record<string, BoundingBox> = {
  WMED: { minLat: 34, maxLat: 42, minLon: -6, maxLon: 15 },
  EMED: { minLat: 30, maxLat: 42, minLon: 15, maxLon: 36 },
  CMED: { minLat: 32, maxLat: 40, minLon: 10, maxLon: 24 },
  BSEA: { minLat: 40, maxLat: 47, minLon: 27, maxLon: 42 },
  CARIB: { minLat: 10, maxLat: 22, minLon: -88, maxLon: -60 },
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeBox = (box: BoundingBox): BoundingBox => {
  const minLat = Math.min(box.minLat, box.maxLat);
  const maxLat = Math.max(box.minLat, box.maxLat);
  const minLon = Math.min(box.minLon, box.maxLon);
  const maxLon = Math.max(box.minLon, box.maxLon);

  const latSpan = Math.abs(maxLat - minLat);
  const lonSpan = Math.abs(maxLon - minLon);

  if (latSpan > MAX_LAT_SPAN || lonSpan > MAX_LON_SPAN) {
    throw new Error(
      `Bounding box too large (lat span ${latSpan.toFixed(2)}, lon span ${lonSpan.toFixed(2)}).` +
        ` Reduce the searched area to keep API usage under budget.`,
    );
  }

  return {
    minLat: clampNumber(minLat, -90, 90),
    maxLat: clampNumber(maxLat, -90, 90),
    minLon: clampNumber(minLon, -180, 180),
    maxLon: clampNumber(maxLon, -180, 180),
  };
};

const parseBoundingBoxToken = (token: string): BoundingBox | null => {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toUpperCase() in AREA_PRESETS) {
    return AREA_PRESETS[trimmed.toUpperCase()];
  }

  if (trimmed.toLowerCase().startsWith("bbox:")) {
    const [, coords] = trimmed.split(":", 2);
    const values = coords?.split("|").map((value) => Number(value));
    if (values?.length === 4 && values.every((value) => !Number.isNaN(value))) {
      return {
        minLat: values[0],
        minLon: values[1],
        maxLat: values[2],
        maxLon: values[3],
      };
    }
  }

  return null;
};

const tokenizeAreaExpression = (expression?: string): BoundingBox[] => {
  if (!expression) {
    return [AREA_PRESETS.WMED];
  }
  const tokens = expression.split(",").map((token) => token.trim()).filter(Boolean);
  const boxes = tokens
    .map(parseBoundingBoxToken)
    .filter((box): box is BoundingBox => Boolean(box))
    .map(normalizeBox);

  return boxes.length ? boxes : [AREA_PRESETS.WMED];
};

const formatMinutesBack = (minutesBack?: number) => {
  if (!minutesBack || Number.isNaN(minutesBack)) {
    return DEFAULT_MINUTES_BACK;
  }
  // API requires minutesBack >= 60
  return clampNumber(Math.round(minutesBack), 60, 720);
};

const mapZoneResults = (vessels: ShipSummary[]): ShipSummary[] => {
  return vessels
    .filter((ship) => !Number.isNaN(ship.lat) && !Number.isNaN(ship.lon))
    .slice(0, MAX_RESULTS);
};

const fetchVesselsInArea = async (
  expression = "",
  options: QueryOptions = {},
  cb: (result: ShipSummary[]) => void,
): Promise<void> => {
  const boxes = tokenizeAreaExpression(expression);
  const minutesBack = formatMinutesBack(options.minutesBack);
  const dedup = new Map<string, ShipSummary>();

  for (const box of boxes) {
    const query: ZoneQuery = {
      minLat: box.minLat,
      maxLat: box.maxLat,
      minLon: box.minLon,
      maxLon: box.maxLon,
      minutesBack,
      response: "simple",
    };
    const vessels = await mstClient.getVesselsInZone(query);
    vessels.forEach((vessel) => {
      const mapped = mapZoneVesselToShip(vessel);
      if (!dedup.has(mapped.id)) {
        dedup.set(mapped.id, mapped);
      }
    });
    if (dedup.size >= MAX_RESULTS) {
      break;
    }
  }

  cb(mapZoneResults(Array.from(dedup.values())));
};

const nauticalMilesToLatDelta = (distanceNm: number) => distanceNm / 60;

const nauticalMilesToLonDelta = (distanceNm: number, latitude: number) => {
  const radians = (latitude * Math.PI) / 180;
  const safeCos = Math.max(Math.cos(radians), 0.1);
  return distanceNm / (60 * safeCos);
};

const fetchVesselsNearMe = async (
  lat = 0,
  lon = 0,
  distance = 5,
  options: QueryOptions = {},
  cb: (result: ShipSummary[]) => void,
) => {
  const safeDistance = clampNumber(distance, 1, 50);
  const minutesBack = formatMinutesBack(options.minutesBack);
  const latDelta = nauticalMilesToLatDelta(safeDistance);
  const lonDelta = nauticalMilesToLonDelta(safeDistance, lat);
  const query: ZoneQuery = {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
    minutesBack,
    response: "simple",
  };
  const vessels = await mstClient.getVesselsInZone(query);
  const mapped = vessels.map(mapZoneVesselToShip);
  cb(mapZoneResults(mapped));
};

export class areaApi {
  static fetchVesselsInArea = fetchVesselsInArea;
  static fetchVesselsNearMe = fetchVesselsNearMe;
}
