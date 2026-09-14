import { createFileRoute } from "@tanstack/react-router";

/**
 * Same-origin API gateway.
 *
 * In production the platform is served behind nginx, which proxies /api/ straight
 * to the FastAPI application. Inside hosted previews there is no nginx, so this
 * route forwards every /api/* request to the upstream API server, keeping the
 * browser on a single origin (no CORS, cookies and bearer tokens pass through).
 */
const DEFAULT_UPSTREAM = "https://medicaps-api.chaoscomputerclub.in/api";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function upstreamBase(): string {
  const configured = process.env["BACKEND_URL"] || process.env["VITE_API_URL"];
  return (configured?.trim() || DEFAULT_UPSTREAM).replace(/\/+$/, "");
}

async function forward({ request, params }: { request: Request; params: { _splat?: string } }) {
  const incoming = new URL(request.url);
  const target = `${upstreamBase()}/${params._splat ?? ""}${incoming.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = !["GET", "HEAD"].includes(request.method);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : null,
      redirect: "manual",
    });

    const outHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== "content-encoding") {
        outHeaders.set(key, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  } catch {
    return Response.json(
      { detail: "The contest API is unreachable right now. Please retry shortly." },
      { status: 502 },
    );
  }
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: forward,
      POST: forward,
      PUT: forward,
      PATCH: forward,
      DELETE: forward,
    },
  },
});
