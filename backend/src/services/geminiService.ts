import { GoogleGenerativeAI, InlineDataPart, Part } from "@google/generative-ai";

interface ShipSnapshot {
  name?: string;
  mmsi?: string | number;
  imo?: string | number;
  lat: number;
  lon: number;
  speed?: number | null;
  course?: number | null;
  destination?: string | null;
  nav_status?: string | null;
  flag?: string | null;
  whaleRisk?: {
    risk_level: string;
    probability: number;
    recommendation: string;
  };
}

interface GeminiInsightRequest {
  ship: ShipSnapshot;
  track?: Array<{ lat: number; lon: number; speed?: number | null; course?: number | null; time?: string }>; // Most recent first
  question?: string;
  recentEvents?: Array<{ timestamp: string; message: string }>;
  mapSnapshot?: {
    mimeType: string;
    dataUrl: string; // data:image/png;base64,
  };
}

export interface GeminiInsightResponse {
  summary: string;
  headline: string;
  riskSignals: Array<{ label: string; detail: string }>;
  recommendedActions: string[];
}

let modelInstance: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }
  if (!modelInstance) {
    const genAI = new GoogleGenerativeAI(apiKey);
    modelInstance = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash-lite"
    });
  }
  return modelInstance;
}

function mapToPrompt(request: GeminiInsightRequest): string {
  const { ship, track, question, recentEvents } = request;
  const headline = ship.name ?? ship.mmsi ?? "Unknown vessel";
  const base = {
    ship: {
      headline,
      position: {
        latitude: ship.lat,
        longitude: ship.lon,
        destination: ship.destination,
        course: ship.course,
        speed: ship.speed,
        status: ship.nav_status,
        flag: ship.flag
      },
      whaleRisk: ship.whaleRisk ?? null
    },
    track: track?.slice(0, 200) ?? [],
    recentEvents: recentEvents ?? [],
    userIntent: question ?? "Provide a succinct briefing that blends navigation, whale risk, and environmental stewardship guidance."
  };

  return JSON.stringify(base, null, 2);
}

function buildImagePart(mapSnapshot?: GeminiInsightRequest["mapSnapshot"]): InlineDataPart | null {
  if (!mapSnapshot) return null;
  const { dataUrl, mimeType } = mapSnapshot;
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return {
    inlineData: {
      data: base64,
      mimeType: mimeType || "image/png"
    }
  };
}

export async function generateGeminiInsight(request: GeminiInsightRequest): Promise<GeminiInsightResponse> {
  const model = getModel();
  const promptPayload = mapToPrompt(request);

  const parts: Part[] = [
    {
      text: "You are Cetacean Copilot, an AI safety officer for ships operating near whale habitats. Blend navigation analytics, whale conservation policy, and human-friendly storytelling. Output concise markdown with sections: headline, summary paragraph, risk signals (3 bullets max), recommended actions (3 bullets max)."
    },
    {
      text: promptPayload
    }
  ];

  const imagePart = buildImagePart(request.mapSnapshot);
  if (imagePart) {
    parts.push({
      text: "Here is the latest chart snapshot captured from the map UI. Use it as visual context for sea lanes and proximity to shore.",
    });
    parts.push(imagePart);
  }

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  const text = result.response.text() ?? "No insight available.";

  // Simple parser to keep consistent response object
  const response: GeminiInsightResponse = {
    headline: "AI Whale Safety Briefing",
    summary: text,
    riskSignals: [],
    recommendedActions: []
  };

  return response;
}
