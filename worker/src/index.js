/**
 * Cloudflare Worker — remove.bg proxy for BuyHacks product image uploads.
 *
 * POST /remove-bg
 *   Body: raw image bytes (Content-Type: image/*)
 *   Returns: transparent PNG from remove.bg
 *
 * Secret: REMOVEBG_API_KEY (set via `wrangler secret put REMOVEBG_API_KEY`)
 */

const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12 MB (remove.bg limit)

function corsHeaders(origin, allowedOrigins) {
  const allowed = allowedOrigins.split(",").map((o) => o.trim());
  if (!allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS || "");

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors || {} });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...(cors || {}) },
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/remove-bg") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...(cors || {}) },
      });
    }

    if (!env.REMOVEBG_API_KEY) {
      return new Response(JSON.stringify({ error: "remove.bg API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...(cors || {}) },
      });
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "Content-Type must be image/*" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...(cors || {}) },
      });
    }

    const imageBytes = await request.arrayBuffer();
    if (imageBytes.byteLength > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "Image exceeds 12 MB limit" }), {
        status: 413,
        headers: { "Content-Type": "application/json", ...(cors || {}) },
      });
    }

    // Build multipart form for remove.bg
    const formData = new FormData();
    formData.append("image_file", new Blob([imageBytes], { type: contentType }), "image.png");
    formData.append("size", "auto");

    try {
      const bgResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": env.REMOVEBG_API_KEY },
        body: formData,
      });

      if (!bgResponse.ok) {
        const errBody = await bgResponse.text();
        return new Response(JSON.stringify({ error: "remove.bg error", detail: errBody }), {
          status: bgResponse.status,
          headers: { "Content-Type": "application/json", ...(cors || {}) },
        });
      }

      const resultPng = await bgResponse.arrayBuffer();
      return new Response(resultPng, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          ...(cors || {}),
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Worker error", detail: err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...(cors || {}) },
      });
    }
  },
};
