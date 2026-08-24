import { describe, expect, it } from "vitest";
import { assertUpdateSize, RejectedPayloadError, SlidingWindowRateLimiter } from "./payload-guards.js";
import { MAX_CLIENT_UPDATE_BYTES } from "@local-first-docs/shared";

describe("assertUpdateSize", () => {
  it("allows an update at or below the cap", () => {
    expect(() => assertUpdateSize(new Uint8Array(MAX_CLIENT_UPDATE_BYTES))).not.toThrow();
  });

  it("rejects an update over the cap", () => {
    expect(() => assertUpdateSize(new Uint8Array(MAX_CLIENT_UPDATE_BYTES + 1))).toThrow(RejectedPayloadError);
  });
});

describe("SlidingWindowRateLimiter", () => {
  it("allows up to the limit within the window", () => {
    const limiter = new SlidingWindowRateLimiter(3, 1000);
    expect(limiter.hit("conn-a")).toBe(false);
    expect(limiter.hit("conn-a")).toBe(false);
    expect(limiter.hit("conn-a")).toBe(false);
  });

  it("flags the connection once it exceeds the limit", () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    limiter.hit("conn-b");
    limiter.hit("conn-b");
    expect(limiter.hit("conn-b")).toBe(true);
  });

  it("tracks connections independently", () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    limiter.hit("conn-c");
    expect(limiter.hit("conn-d")).toBe(false);
  });

  it("expires old hits outside the window", async () => {
    const limiter = new SlidingWindowRateLimiter(1, 20);
    limiter.hit("conn-e");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(limiter.hit("conn-e")).toBe(false);
  });
});
