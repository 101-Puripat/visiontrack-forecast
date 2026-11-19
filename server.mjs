import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validateTrack } from "./counts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, "videos");
const PORT = Number(process.env.PORT || 3000);

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

const MIME_TYPES = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ogg": "video/ogg",
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function findZoneVideo(number) {
  const pattern = new RegExp(`^zone${number}\\.(mp4|webm|mov|ogg)$`, "i");
  return fs.readdirSync(VIDEOS_DIR).find(file => pattern.test(file) && fs.statSync(path.join(VIDEOS_DIR, file)).isFile()) || null;
}

function matchingCountTrack(number, videoFile = findZoneVideo(number)) {
  if (!videoFile) return null;
  try {
    const track = JSON.parse(fs.readFileSync(path.join(__dirname, `data/zone${number}.counts.json`), "utf8"));
    const digest = createHash("sha256").update(fs.readFileSync(path.join(VIDEOS_DIR, videoFile))).digest("hex");
    return validateTrack(track) && track.videoSha256 === digest ? track : null;
  } catch {
    return null;
  }
}

function streamVideo(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const range = req.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = match?.[1] ? Number(match[1]) : 0;
    let end = match?.[2] ? Number(match[2]) : fileSize - 1;
    if (match && !match[1] && match[2]) { start = Math.max(0, fileSize - Number(match[2])); end = fileSize - 1; }
    end = Math.min(end, fileSize - 1);
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileSize) {
      res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
      res.end();
      return;
    }
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
    });
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    });
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/zones") {
    const zones = [1, 2, 3, 4].map((num) => {
      const file = findZoneVideo(num);
      const track = matchingCountTrack(num, file);
      return {
        id: `zone${num}`,
        number: num,
        label: `Zone ${num}`,
        fileName: file,
        videoUrl: file ? `/videos/${encodeURIComponent(file)}` : null,
        countsUrl: track ? `/data/zone${num}.counts.json` : null,
      };
    });
    sendJson(res, 200, { zones });
    return;
  }

  const countRequest = /^\/data\/zone([1-4])\.counts\.json$/.exec(url.pathname);
  if (req.method === "GET" && countRequest) {
    const track = matchingCountTrack(Number(countRequest[1]));
    sendJson(res, track ? 200 : 404, track || { error: "No count data matching the current video" });
    return;
  }

  const staticAssets = { "/app.mjs": "text/javascript", "/counts.mjs": "text/javascript", "/styles.css": "text/css" };
  if (req.method === "GET" && Object.hasOwn(staticAssets, url.pathname)) {
    res.writeHead(200, { "Content-Type": `${staticAssets[url.pathname]}; charset=utf-8` });
    res.end(fs.readFileSync(path.join(__dirname, url.pathname.slice(1))));
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/videos/")) {
    let fileName;
    try { fileName = decodeURIComponent(url.pathname.slice("/videos/".length)); }
    catch { res.writeHead(400); res.end("Invalid video path"); return; }
    const safeName = path.basename(fileName);
    const filePath = path.join(VIDEOS_DIR, safeName);
    if (/^zone[1-4]\.(mp4|webm|mov|ogg)$/i.test(safeName) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      streamVideo(req, res, filePath);
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\nVisionTrack Forecast running at http://localhost:${PORT}`);
  console.log(`Videos folder: ${VIDEOS_DIR} (one video per matching zone)\n`);
});
