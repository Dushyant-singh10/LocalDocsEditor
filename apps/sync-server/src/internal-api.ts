import type { IncomingMessage, ServerResponse } from "node:http";
import type { Hocuspocus } from "@hocuspocus/server";
import type { SyncContext } from "./context.js";
import { captureSnapshot, restoreVersion } from "./snapshot.js";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

// Server-to-server API used only by apps/web (never exposed to browsers).
// Restoring/snapshotting a document requires touching the live, in-memory
// Y.Doc, which only this process holds — apps/web cannot do this itself, so
// it calls in here instead. Protected by a shared bearer secret; both sides
// run over HTTPS in every deployed environment.
//
// Shares one HTTP server/port with the Hocuspocus websocket in index.ts
// (rather than binding its own port) — hosting platforms with a single
// public port per service (e.g. Render's free tier) can't expose two.
// Returns true if it handled the request, false if the caller should try
// something else (e.g. respond 404 itself).
export async function handleInternalApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  hocuspocus: Hocuspocus<SyncContext>,
): Promise<boolean> {
  if (!(req.url ?? "").startsWith("/internal/")) {
    return false;
  }

  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_SYNC_SECRET is not set");
  }

  try {
    await handleRequest(req, res, hocuspocus, secret);
  } catch (error) {
    console.error("[internal-api] unhandled error", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "internal_error" }));
  }
  return true;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  hocuspocus: Hocuspocus<SyncContext>,
  secret: string,
): Promise<void> {
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const url = new URL(req.url ?? "/", "http://internal");
  const snapshotMatch = url.pathname.match(/^\/internal\/documents\/([^/]+)\/snapshot$/);
  const restoreMatch = url.pathname.match(/^\/internal\/documents\/([^/]+)\/restore$/);

  if (req.method === "POST" && snapshotMatch) {
    const documentId = decodeURIComponent(snapshotMatch[1]);
    const result = await captureSnapshot(hocuspocus, documentId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        contentJson: result.contentJson,
        stateSnapshot: result.stateSnapshot.toString("base64"),
      }),
    );
    return;
  }

  if (req.method === "POST" && restoreMatch) {
    const documentId = decodeURIComponent(restoreMatch[1]);
    const body = await readJsonBody(req);
    if (
      typeof body !== "object" ||
      body === null ||
      !("contentJson" in body) ||
      !("userId" in body) ||
      !("versionId" in body)
    ) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_body" }));
      return;
    }

    const { contentJson, userId, versionId } = body as {
      contentJson: Record<string, unknown>;
      userId: string;
      versionId: string;
    };

    const result = await restoreVersion(hocuspocus, documentId, contentJson, { userId, versionId });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        contentJson: result.contentJson,
        stateSnapshot: result.stateSnapshot.toString("base64"),
      }),
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}
