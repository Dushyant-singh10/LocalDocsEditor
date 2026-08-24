import type { beforeHandleMessagePayload } from "@hocuspocus/server";
import type { SyncContext } from "../context.js";
import { assertUpdateSize, SlidingWindowRateLimiter } from "../validation/payload-guards.js";

// Sliding window across ALL messages (sync + awareness), not just accepted
// writes — this is what catches a flood of small-but-otherwise-valid
// messages that a per-message size cap alone would let through.
const rateLimiter = new SlidingWindowRateLimiter(50, 1000);

export async function onBeforeHandleMessage(
  data: beforeHandleMessagePayload<SyncContext>,
): Promise<void> {
  // Reject before a single byte is handed to the Yjs/y-protocols decoder —
  // this is the app-level backstop behind the WS transport's own maxPayload.
  assertUpdateSize(data.update);

  if (rateLimiter.hit(data.socketId)) {
    throw new Error(`Rate limit exceeded for connection ${data.socketId}`);
  }
}
