const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT || 3333);
const TOKEN = process.env.BRAPI_TOKEN || "";
const BASE_URL = "https://brapi.dev/api/quote";

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);

  if (!url.pathname.startsWith("/quote/")) {
    return sendJson(res, 404, { error: "Not found" });
  }

  const ticker = decodeURIComponent(url.pathname.replace("/quote/", ""));
  if (!ticker) {
    return sendJson(res, 400, { error: "Missing ticker" });
  }

  const range = url.searchParams.get("range") || "3mo";
  const interval = url.searchParams.get("interval") || "1d";
  const modules = url.searchParams.get("modules") || "summaryProfile";

  const target = new URL(`${BASE_URL}/${encodeURIComponent(ticker)}`);
  target.searchParams.set("range", range);
  target.searchParams.set("interval", interval);
  target.searchParams.set("modules", modules);
  if (TOKEN) target.searchParams.set("token", TOKEN);

  https
    .get(target, (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 500;
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      proxyRes.pipe(res);
    })
    .on("error", (err) => {
      sendJson(res, 502, { error: "Proxy error", message: String(err) });
    });
});

server.listen(PORT, () => {
  console.log(`BRAPI proxy running on http://localhost:${PORT}`);
});
