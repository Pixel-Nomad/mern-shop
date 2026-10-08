import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { __test__ } from "../../../middleware/rateLimiter.js";
import { errorHandler } from "../../../middleware/errorHandler.js";
import { notFound } from "../../../middleware/notFound.js";

const { buildLimiter, makeMiddleware } = __test__;

/**
 * These tests use a strictly-configured limiter with a tiny window
 * so we can trigger blocking quickly. The app's real limiters are
 * no-ops in test mode (see rateLimiter.ts).
 */
const buildTestApp = (points: number, durationSec: number) => {
  const limiter = buildLimiter(points, durationSec, 0);
  const app = express();
  app.use(express.json());
  app.use(makeMiddleware(limiter));
  app.get("/test", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
};
let app: express.Express;

afterEach(() => {
  // Fresh app for every test — fresh in-memory limiter state.
  app = buildTestApp(3, 60);
});

describe("rate limiter", () => {
  it("allows requests under the limit", async () => {
    app = buildTestApp(3, 60);

    const r1 = await request(app).get("/test");
    const r2 = await request(app).get("/test");

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.headers["x-ratelimit-limit"]).toBe("3");
    expect(r1.headers["x-ratelimit-remaining"]).toBe("2");
    expect(r2.headers["x-ratelimit-remaining"]).toBe("1");
  });

  it("blocks after exceeding the limit", async () => {
    app = buildTestApp(3, 60);

    await request(app).get("/test");
    await request(app).get("/test");
    await request(app).get("/test");

    const blocked = await request(app).get("/test");

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many/i);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("sets rate-limit reset header", async () => {
    app = buildTestApp(5, 60);

    const res = await request(app).get("/test");

    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
    const reset = new Date(res.headers["x-ratelimit-reset"] as string);
    expect(reset.getTime()).toBeGreaterThan(Date.now());
  });

  it("keys limiters independently per key", async () => {
    // Two different limiters keyed by IP behave independently.
    const limiterA = buildLimiter(2, 60, 0);
    const limiterB = buildLimiter(2, 60, 0);

    const a1 = await limiterA.consume("ip-a");
    const a2 = await limiterA.consume("ip-a");

    expect(a1.remainingPoints).toBe(1);
    expect(a2.remainingPoints).toBe(0);

    // limiterB has its own counter
    const b1 = await limiterB.consume("ip-a");
    expect(b1.remainingPoints).toBe(1);
  });
});