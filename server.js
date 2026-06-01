import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ROOT = process.cwd();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/fuse") {
      await handleFuse(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Server error" });
  }
}).listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

async function handleFuse(req, res) {
  if (!OPENAI_API_KEY) {
    sendJson(res, 500, {
      error: "OPENAI_API_KEY is not set.",
    });
    return;
  }

  const body = await readJson(req);
  const { prompt, firstPokemon, secondPokemon } = body;

  if (!prompt || !firstPokemon || !secondPokemon) {
    sendJson(res, 400, { error: "Missing prompt or pokemon payload." });
    return;
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1.5",
      prompt,
      n: 1,
      size: "1024x1024",
      output_format: "png",
      background: "transparent",
      moderation: "auto",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    sendJson(res, response.status, {
      error: "OpenAI image generation failed.",
      detail: errorText,
    });
    return;
  }

  const data = await response.json();
  const imageBase64 = data?.data?.[0]?.b64_json;

  if (!imageBase64) {
    sendJson(res, 500, { error: "No image returned from OpenAI." });
    return;
  }

  sendJson(res, 200, {
    image: `data:image/png;base64,${imageBase64}`,
    prompt,
    firstPokemon,
    secondPokemon,
  });
}

async function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/02_pokeapi.html" : req.url;
  const filePath = join(ROOT, decodeURIComponent(urlPath));
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  const file = await readFile(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(file);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
