"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mstClient_1 = require("./src/services/mstClient");
dotenv_1.default.config();
async function testConnection() {
    console.log("Testing MyShipTracking API connection...");
    console.log("API Key present:", !!process.env.MST_API_KEY);
    if (process.env.MST_API_KEY) {
        console.log("API Key length:", process.env.MST_API_KEY.length);
        console.log("API Key start:", process.env.MST_API_KEY.substring(0, 4));
    }
    try {
        console.log("\n1. Testing Port Search (Hamburg)...");
        const ports = await mstClient_1.mstClient.searchPorts("Hamburg");
        console.log("Port Search Result:", JSON.stringify(ports, null, 2));
        console.log("\n2. Testing Vessels In Zone (Gibraltar Strait)...");
        // Gibraltar Strait area
        const vessels = await mstClient_1.mstClient.getVesselsInZone({
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
    }
    catch (error) {
        console.error("API Test Failed:", error.message);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response data:", error.response.data);
        }
    }
}
testConnection();
