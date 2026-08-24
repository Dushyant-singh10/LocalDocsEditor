import "./load-env.js"; // must stay the first import — see load-env.ts
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Hocuspocus } from "@hocuspocus/server";
import { Throttle } from "@hocuspocus/extension-throttle";
import { MAX_WS_FRAME_BYTES } from "@local-first-docs/shared";
import type { SyncContext } from "./context.js";
import { onAuthenticate } from "./hooks/on-authenticate.js";
import { onLoadDocument } from "./hooks/on-load-document.js";
import { onStoreDocument } from "./hooks/on-store-document.js";
import { onBeforeHandleMessage } from "./hooks/on-before-handle-message.js";
import { onBeforeSync } from "./hooks/on-before-sync.js";
import { handleInternalApiRequest } from "./internal-api.js";
import { nodeRequestToFetchRequest } from "./node-request-to-fetch-request.js";

const PORT = Number(process.env.PORT ?? 1234);

// A single Hocuspocus core instance (not the `Server` wrapper, which insists
// on owning its own HTTP server/port) wired by hand to one plain http.Server
// that handles BOTH the realtime websocket upgrade AND the internal
// snapshot/restore REST API on the same port. This is required for
// single-port hosting platforms (e.g. Render's free tier) — Fly.io-style
// multi-port-per-app support isn't universal.
const hocuspocus = new Hocuspocus<SyncContext>({
  extensions: [
    // Throttles new *connection attempts* per IP. Separate axis from the
    // per-connection message-rate limiter in onBeforeHandleMessage, which
    // guards an already-open connection from flooding with small updates.
    new Throttle({ throttle: 30, consideredSeconds: 60, banTime: 5 }),
  ],
  onAuthenticate,
  onLoadDocument,
  onStoreDocument,
  beforeHandleMessage: onBeforeHandleMessage,
  beforeSync: onBeforeSync,
});

const httpServer = createServer((req, res) => {
  handleInternalApiRequest(req, res, hocuspocus)
    .then((handled) => {
      if (!handled) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Local-First Docs sync server");
      }
    })
    .catch((error) => {
      console.error("[http] unhandled error", error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
});

// Transport-level hard cap: an oversized frame is rejected by the socket
// layer before a single byte reaches Yjs decoding.
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_FRAME_BYTES });

httpServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    const clientConnection = hocuspocus.handleConnection(ws, nodeRequestToFetchRequest(request));

    ws.on("message", (data, isBinary) => {
      if (!isBinary) return; // Hocuspocus's protocol is always binary; ignore stray text frames.
      clientConnection.handleMessage(data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer));
    });

    ws.on("close", (code, reason) => {
      clientConnection.handleClose({ code, reason: reason.toString() });
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`[sync-server] listening on ${PORT} (websocket + internal API on one port)`);
});
