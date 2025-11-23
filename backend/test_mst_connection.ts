import dotenv from "dotenv";
import { mstClient } from "./src/services/mstClient";

dotenv.config();

async function testConnection() {
  console.log("Testing MyShipTracking API connection...");
  console.log("API Key present:", !!process.env.MST_API_KEY);
  if (process.env.MST_API_KEY) {
    console.log("API Key length:", process.env.MST_API_KEY.length);
    console.log("API Key start:", process.env.MST_API_KEY.substring(0, 4));
  }

  try {
    console.log("\n1. Testing Port Search (Hamburg)...");
    const ports = await mstClient.searchPorts("Hamburg");
    console.log("Port Search Result:", JSON.stringify(ports, null, 2));

    console.log("\n2. Testing Vessels In Zone (Gibraltar Strait)...");
    // Gibraltar Strait area
    const vessels = await mstClient.getVesselsInZone({
      minLat: 35.8,
      maxLat: 36.2,
      minLon: -5.8,
      maxLon: -5.2,
      minutesBack: 60
    });
    console.log(`Found ${vessels.length} vessels in zone.`);
    if (vessels.length > 0) {
      console.log("Sample vessel:", JSON.stringify(vessels[0], null, 2));
    }

  } catch (error: any) {
    console.error("API Test Failed:", error.message);
    if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
    }
  }
}

testConnection();
