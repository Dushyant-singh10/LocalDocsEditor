import type { IncomingMessage } from "node:http";

// Hocuspocus's core `handleConnection(ws, request)` expects a standard Fetch
// API `Request` (it reads `request.headers` as a `Headers` instance and
// `request.url` as an absolute URL) — that's what its normal transport
// (crossws) hands it. Wiring Hocuspocus to a plain `ws` WebSocketServer
// ourselves means building that same shape by hand from Node's raw
// `IncomingMessage`.
export function nodeRequestToFetchRequest(req: IncomingMessage): Request {
  const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
  const host = req.headers.host ?? "localhost";
  const url = `${protocol}://${host}${req.url ?? "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  return new Request(url, { method: req.method ?? "GET", headers });
}
