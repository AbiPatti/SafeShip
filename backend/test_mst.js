"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fetchMST = async () => {
    try {
        const response = await axios_1.default.get('https://www.myshiptracking.com/requests/vesselsonmap.php', {
            params: {
                type: 'json',
                minlat: 30,
                maxlat: 45,
                minlon: 10,
                maxlon: 30,
                zoom: 5
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.myshiptracking.com/'
            }
        });
        console.log(response.data);
    }
    catch (error) {
        console.error(error);
    }
};
fetchMST();
