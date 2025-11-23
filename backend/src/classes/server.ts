import express from "express";
import cors from "cors";
import path from "path";
import { api } from "../legacy/api";
import { areaApi } from "../legacy/area";
import { mstClient } from "../services/mstClient";
import { whaleRiskService } from "../services/whaleRiskService";
import ADSBexchange from "./sources/adsb/adsbe";
class Server {
  app: any;
  server: any;
  constructor(port) {
    this.init(port);
  }

  init(port: number) {
    this.app = express();
    this.app.set("port", port);
    
    // Parse JSON bodies
    this.app.use(express.json());
    
    this.app.use(
      cors({
        origin: "*",
      }),
    );
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
    this.app.get("/", (_request: any, response: any) => {
      response.sendFile(path.join(__dirname, "/../static/index.html"));
    });
    this.loadLegacyRoutes();
    this.loadRoutes();
    this.server = this.app.listen(this.app.get("port"), () => {
      console.log("Node this.appp is running on port", this.app.get("port"));
    });
    this.server.on("error", (err: any) => {
      console.error("Server failed to start:", err);
    });
  }

  close() {
    if (this.server) {
      this.server.close();
      console.log("Server closed");
    }
  }

  loadRoutes() {
    // /:sourcetype/:source/:vehicleidentifier/location/latest
    this.app.get(
      "/ais/mt/:mmsi/location/latest",
      async (req: any, res: any) => {
        try {
          api.getLocationFromMT(req.params.mmsi, (result) => {
            res.send({
              error: null,
              data: result,
            });
          });
        } catch (error) {
          res.send({
            error: error || "Unknown error",
            data: null,
          });
        }
      },
    );
    this.app.get(
      "/adsb/adsbe/:icao/location/latest",
      async (req: any, res: any) => {
        console.log(req.params.icao);
        const adsbe = new ADSBexchange();
        const location = await adsbe.getLocation(req.params.icao);
        console.log(location);
        res.send({
          error: null,
          data: location,
        });
      },
    );

    this.app.get("/api/vessels/search/:name", async (req: any, res: any) => {
      try {
        const results = await mstClient.searchVessels(req.params.name);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.get("/api/vessels/status/:mmsi", async (req: any, res: any) => {
      try {
        const result = await mstClient.getVesselStatus({
          mmsi: req.params.mmsi,
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.get("/api/vessels/track/:mmsi", async (req: any, res: any) => {
      try {
        const days = req.query.days ? Number(req.query.days) : undefined;
        const results = await mstClient.getVesselTrack(req.params.mmsi, {
          days: days || 1,
        });
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Whale Risk API endpoints
    this.app.post("/api/whale-risk", async (req: any, res: any) => {
      try {
        const { latitude, longitude, month } = req.body;
        if (latitude === undefined || longitude === undefined) {
          return res.status(400).json({ error: "latitude and longitude are required" });
        }
        const risk = await whaleRiskService.getWhaleRisk(latitude, longitude, month);
        res.json(risk);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.get("/api/vessels/status/:mmsi/whale-risk", async (req: any, res: any) => {
      try {
        const vessel = await mstClient.getVesselStatus({ mmsi: req.params.mmsi });
        
        // Get whale risk for vessel's current position
        const whaleRisk = await whaleRiskService.getWhaleRisk(vessel.lat, vessel.lng);
        
        res.json({
          vessel: vessel,
          whale_risk: whaleRisk
        });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }

  loadLegacyRoutes() {
    // this route is wrongly named on purpose for legacy reasons.
    // AS VF is not as easy to reverse as the other ones, it is replaced by MST
    this.app.get(
      "/legacy/getLastPositionFromVF/:mmsi",
      (req: any, res: any) => {
        api.getLocationFromMST(req.params.mmsi, (result) => {
          res.send(result);
        });
      },
    );
    this.app.get(
      "/legacy/getLastPositionFromMT/:mmsi",
      (req: any, res: any) => {
        api.getLocationFromMT(req.params.mmsi, (result) => {
          res.send(result);
        });
      },
    );
    this.app.get("/legacy/getLastPosition/:mmsi", (req: any, res: any) => {
      api.getLocation(req.params.mmsi, (result) => {
        res.send(result);
      });
    });
    // e.g. /getVesselsInArea/WMED,EMED
    this.app.get(
      "/legacy/getVesselsInArea/:area",
      async (req: any, res: any) => {
        try {
          const areaExpression = decodeURIComponent(req.params.area ?? "");
          const minutesBack = req.query.minutesBack
            ? Number(req.query.minutesBack)
            : undefined;

          await areaApi.fetchVesselsInArea(
            areaExpression,
            { minutesBack },
            (result) => {
              res.json(result);
            },
          );
        } catch (error) {
          res.status(400).json({
            error:
              (error as Error)?.message ??
              "Unable to parse area expression. Use bbox:minLat|minLon|maxLat|maxLon",
            data: [],
          });
        }
      },
    );
    this.app.get(
      "/legacy/getVesselsNearMe/:lat/:lng/:distance",
      async (req: any, res: any) => {
        const lat = Number(req.params.lat);
        const lon = Number(req.params.lng);
        const distance = Number(req.params.distance);

        if ([lat, lon, distance].some((value) => Number.isNaN(value))) {
          res.status(400).json({
            error: "lat, lng and distance must be numeric",
            data: [],
          });
          return;
        }

        const minutesBack = req.query.minutesBack
          ? Number(req.query.minutesBack)
          : undefined;

        try {
          await areaApi.fetchVesselsNearMe(
            lat,
            lon,
            distance,
            { minutesBack },
            (result) => {
              res.json(result);
            },
          );
        } catch (error) {
          console.error("Error in getVesselsNearMe:", error);
          res.status(400).json({
            error:
              (error as Error)?.message ??
              "Unable to fetch nearby vessels from MyShipTracking.",
            data: [],
          });
        }
      },
    );
    this.app.get("/legacy/getVesselsInPort/:shipPort", (req: any, res: any) => {
      api.getVesselsInPort(req.params.shipPort, (result) => {
        res.send(result);
      });
    });
  }
}

export default Server;
