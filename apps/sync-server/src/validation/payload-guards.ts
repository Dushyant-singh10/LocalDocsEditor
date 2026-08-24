import { MAX_CLIENT_UPDATE_BYTES, MAX_DOCUMENT_STATE_BYTES } from "@local-first-docs/shared";

export class RejectedPayloadError extends Error {}

export function assertUpdateSize(update: Uint8Array): void {
  if (update.byteLength > MAX_CLIENT_UPDATE_BYTES) {
    throw new RejectedPayloadError(
      `Update of ${update.byteLength} bytes exceeds the ${MAX_CLIENT_UPDATE_BYTES}-byte per-message cap`,
    );
  }
}

export function warnIfDocumentStateTooLarge(documentName: string, byteLength: number): void {
  if (byteLength > MAX_DOCUMENT_STATE_BYTES) {
    // Intentionally not throwing: refusing to persist would destroy the
    // user's edit. This is a signal to page/alert + investigate GC/compaction,
    // not a hard stop.
    console.warn(
      `[document-size] document ${documentName} compacted state is ${byteLength} bytes, exceeding the ${MAX_DOCUMENT_STATE_BYTES}-byte soft ceiling`,
    );
  }
}

// Sliding-window per-connection rate limiter for update messages. Guards
// against a flood of small-but-valid messages, which a size cap alone does
// not catch.
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true if `key` is currently over the limit. Records this hit either way. */
  hit(key: string): boolean {
    const now = Date.now();
    const timestamps = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    timestamps.push(now);
    this.hits.set(key, timestamps);
    return timestamps.length > this.limit;
  }

  forget(key: string): void {
    this.hits.delete(key);
  }
}
