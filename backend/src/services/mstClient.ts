import fetch from "node-fetch";

export type MstResponseType = "simple" | "extended";

interface MstEnvelope<T> {
  status: "success" | "error";
  data: T;
  message?: string;
  code?: string;
}

export interface ZoneQuery {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  minutesBack?: number;
  response?: MstResponseType;
}

export interface NearbyQuery {
  lat: number;
  lon: number;
  distanceNm: number;
  minutesBack?: number;
}

export interface MstZoneVessel {
  vessel_name: string;
  mmsi?: number | null;
  imo?: number | null;
  vtype?: number | null;
  lat: number;
  lng: number;
  course?: number | null;
  speed?: number | null;
  nav_status?: string | null;
  received: string;
}

export interface MstNearbyVessel extends MstZoneVessel {
  distance: number;
  bearing: number;
}

export interface MstTrackPoint {
  lat: number;
  lng: number;
  course: number;
  speed: number;
  time: string;
}

export interface MstVesselSearchResult {
  vessel_name: string;
  mmsi: number;
  imo?: number | null;
  vtype: number;
  vessel_type: string;
  flag: string;
  area: string;
}

export interface MstVesselStatus extends MstZoneVessel {
  callsign?: string | null;
  vessel_type?: string | null;
  destination?: string | null;
  current_port?: string | null;
  next_port?: string | null;
  flag?: string | null;
}

export interface MstPortSearchResult {
  port_id: number;
  name: string;
  unloco: string;
  port_type: string;
  country: string;
}

export interface MstPortVessel {
  mmsi?: number | null;
  imo?: number | null;
  name: string;
  arrived?: string;
  vtype?: number | null;
  vessel_type?: string;
  flag?: string;
  gt?: number | null;
  dwt?: number | null;
  built?: number | null;
  length?: number | null;
  width?: number | null;
}

export interface BulkStatusQuery {
  mmsi?: Array<number | string>;
  imo?: Array<number | string>;
  response?: MstResponseType;
  src?: "ter" | "sat";
}

interface CacheEntry<T> {
  expiresAt: number;
  payload: T;
}

const DEFAULT_BASE_URL = "https://api.myshiptracking.com/api/v2";
const DEFAULT_CACHE_MS = Number(process.env.MST_CACHE_TTL_MS ?? 30_000);

class MyShipTrackingClient {
  private cache = new Map<string, CacheEntry<unknown>>();
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.MST_API_BASE ?? DEFAULT_BASE_URL;
  }

  private get apiKey(): string {
    const key = process.env.MST_API_KEY;
    if (!key) {
      throw new Error("Missing MST_API_KEY environment variable");
    }
    return key;
  }

  private buildHeaders() {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private buildCacheKey(path: string, params?: Record<string, unknown>): string {
    if (!params) return path;
    const keys = Object.keys(params).sort();
    const serialized = keys
      .map((key) => `${key}:${String(params[key] ?? "")}`)
      .join("|");
    return `${path}?${serialized}`;
  }

  private readCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.payload as T;
  }

  private writeCache<T>(key: string, payload: T, ttlMs: number) {
    if (ttlMs <= 0) return;
    this.cache.set(key, { payload, expiresAt: Date.now() + ttlMs });
  }

  private sanitizeParams(
    params?: Record<string, string | number | undefined>,
  ): Record<string, string> {
    if (!params) return {};
    return Object.entries(params).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (value === undefined || value === null) return acc;
        acc[key] = String(value);
        return acc;
      },
      {},
    );
  }

  private async request<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    cacheMs = DEFAULT_CACHE_MS,
  ): Promise<T> {
    const normalizedParams = this.sanitizeParams(params);
    const cacheKey = this.buildCacheKey(path, normalizedParams);
    if (cacheMs > 0) {
      const cached = this.readCache<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const url = new URL(`${this.baseUrl}/${path}`);
    Object.entries(normalizedParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.buildHeaders(),
    });

    const text = await response.text();
    let payload: MstEnvelope<T>;
    try {
      payload = JSON.parse(text) as MstEnvelope<T>;
    } catch (error) {
      throw new Error(
        `[MST] Failed to parse response for ${path}: ${(error as Error).message}`,
      );
    }

    if (!response.ok || payload.status !== "success") {
      throw new Error(
        `[MST] Request failed (${payload.code ?? response.status}): ${payload.message ?? "Unknown error"}`,
      );
    }

    if (cacheMs > 0) {
      this.writeCache(cacheKey, payload.data, cacheMs);
    }

    return payload.data;
  }

  async getVesselStatus(params: {
    mmsi?: number | string;
    imo?: number | string;
    response?: MstResponseType;
  }): Promise<MstVesselStatus> {
    if (!params.mmsi && !params.imo) {
      throw new Error("Either mmsi or imo must be provided for vessel status");
    }
    return await this.request<MstVesselStatus>("vessel", params, 0);
  }

  async getVesselsInZone(query: ZoneQuery): Promise<MstZoneVessel[]> {
    const params: Record<string, string | number> = {
      minlat: query.minLat,
      maxlat: query.maxLat,
      minlon: query.minLon,
      maxlon: query.maxLon,
      response: query.response ?? "simple",
    };

    if (query.minutesBack) {
      params.minutesBack = query.minutesBack;
    }

    // Cache for 5 minutes to save credits
    return await this.request<MstZoneVessel[]>("vessel/zone", params, 300_000);
  }

  async getVesselsNearby(mmsi: number, radius: number = 20): Promise<MstNearbyVessel[]> {
    // Cache for 5 minutes
    return await this.request<MstNearbyVessel[]>("vessel/nearby", { mmsi, radius }, 300_000);
  }

  async getVesselTrack(
    mmsi: number | string,
    options: {
      fromdate?: string;
      todate?: string;
      days?: number;
      timegroup?: number;
    },
  ): Promise<MstTrackPoint[]> {
    const params: Record<string, string | number> = { mmsi };
    if (options.fromdate) params.fromdate = options.fromdate;
    if (options.todate) params.todate = options.todate;
    if (options.days) params.days = options.days;
    if (options.timegroup) params.timegroup = options.timegroup;

    return await this.request<MstTrackPoint[]>("vessel/track", params, 60_000);
  }

  async searchVessels(name: string): Promise<MstVesselSearchResult[]> {
    return await this.request<MstVesselSearchResult[]>(
      "vessel/search",
      { name },
      60_000,
    );
  }

  async searchPorts(name: string): Promise<MstPortSearchResult[]> {
    return await this.request<MstPortSearchResult[]>(
      "port/search",
      { name },
      5 * 60 * 1000,
    );
  }

  async getVesselsInPort(options: {
    portId?: number;
    unloco?: string;
  }): Promise<MstPortVessel[]> {
    if (!options.portId && !options.unloco) {
      throw new Error("portId or unloco must be provided for Vessels In Port");
    }

    const params: Record<string, string | number> = {};
    if (options.portId) {
      params.port_id = options.portId;
    }
    if (options.unloco) {
      params.unloco = options.unloco;
    }

    // Port occupancy does not change super fast, cache for a minute
    return await this.request<MstPortVessel[]>("port/inport", params, 60_000);
  }

  async getBulkVesselStatus(
    query: BulkStatusQuery,
  ): Promise<MstZoneVessel[]> {
    const payload: Record<string, string> = {
      response: query.response ?? "simple",
    };

    const hasMmsi = Array.isArray(query.mmsi) && query.mmsi.length;
    const hasImo = Array.isArray(query.imo) && query.imo.length;

    if (!hasMmsi && !hasImo) {
      throw new Error(
        "At least one MMSI or IMO must be provided for bulk vessel status",
      );
    }

    const sanitizeList = (list?: Array<number | string>) =>
      (list ?? [])
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
        .slice(0, 100)
        .join(",");

    if (hasMmsi) {
      payload.mmsi = sanitizeList(query.mmsi);
    }

    if (hasImo) {
      payload.imo = sanitizeList(query.imo);
    }

    if (query.src) {
      payload.src = query.src;
    }

    return await this.request<MstZoneVessel[]>("vessel/bulk", payload, 5_000);
  }
}

export const mstClient = new MyShipTrackingClient();
