const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const scrapeJsonFromResponse = async (options, cb) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      // Required for Docker version of Puppeteer
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // This will write shared memory files into /tmp instead of /dev/shm,
      // because Docker’s default for /dev/shm is 64MB
      "--disable-dev-shm-usage",
    ],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "x-requested-with": "XMLHttpRequest",
    referer: options.referer,
    ...options.extraHeaders,
  });
  page.on("request", (interceptedRequest) => {
    const reqUrl = interceptedRequest.url();
    console.log("A request was started: ", reqUrl);
  });
  page.on("requestfinished", async (request) => {
    const resUrl = request.url();
    if (resUrl.indexOf(options.responseSelector) !== -1) {
      const response = request.response();
      try {
        const json = await response.json();
        console.log("A response was received: ", await response.url());
        cb(json);
      } catch (e) {
        console.error("Failed to parse JSON from response. It might be blocked by Cloudflare.");
        // console.log("Response text:", await response.text()); // Optional: debug
        cb(null);
      }
    }
  });
  // Mock real desktop chrome
  page.setViewport({
    height: 1080,
    width: 1920,
  });
  page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "languages", {
      get: function () {
        return ["en-US", "en", "de-DE"];
      },
    });
    Object.defineProperty(navigator, "plugins", {
      get: function () {
        // this just needs to have `length > 0`, but we could mock the plugins too
        return [1, 2, 3, 4, 5];
      },
    });
  });

  // console.log("Navigating to MarineTraffic homepage to warm up cookies...");
  // try {
  //   await page.goto("https://www.marinetraffic.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  //   console.log("Homepage loaded. Waiting for potential Cloudflare checks...");
  //   await new Promise(r => setTimeout(r, 10000)); // Wait longer for Cloudflare
  // } catch (e) {
  //   console.log("Homepage load failed or timed out, proceeding to target...");
  // }

  console.log("Navigating to target URL...");
  await page.goto(options.url, { waitUntil: "networkidle0", timeout: 60000 });

  // Keep browser open for a bit to ensure requests finish
  // await new Promise(r => setTimeout(r, 5000));
  await browser.close();
};

module.exports = {
  fetch: scrapeJsonFromResponse,
};
