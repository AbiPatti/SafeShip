/**
 * Whale Risk Service
 * Integrates with the Python ML API to get whale presence predictions
 */

interface WhaleRiskPrediction {
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  probability: number;
  recommendation: string;
  latitude: number;
  longitude: number;
  month: number;
}

interface RouteRiskSummary {
  average_probability: number;
  highest_risk_location: {
    latitude: number;
    longitude: number;
    probability: number;
    risk_level: string;
  };
}

class WhaleRiskService {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:5002") {
    this.baseUrl = baseUrl;
  }

  /**
   * Get whale risk for a specific location
   */
  async getWhaleRisk(
    latitude: number,
    longitude: number,
    month?: number
  ): Promise<WhaleRiskPrediction> {
    try {
      const response = await fetch(`${this.baseUrl}/api/whale-risk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ latitude, longitude, month }),
      });

      if (!response.ok) {
        throw new Error(`Whale risk API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get whale risk:", error);
      throw error;
    }
  }

  /**
   * Get whale risk along a route
   */
  async getRouteRisk(waypoints: Array<{ lat: number; lon: number }>) {
    try {
      const response = await fetch(`${this.baseUrl}/api/whale-risk/route`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ waypoints }),
      });

      if (!response.ok) {
        throw new Error(`Whale risk API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get route whale risk:", error);
      throw error;
    }
  }

  /**
   * Check if whale risk service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const whaleRiskService = new WhaleRiskService();
export type { WhaleRiskPrediction, RouteRiskSummary };
