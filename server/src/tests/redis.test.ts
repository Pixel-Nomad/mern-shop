import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis, pingRedis, disconnectRedis } from "../config/redis.js";

beforeAll(async () => {
  // Wait for Redis to be ready (ioredis connects async).
  if (redis.status !== "ready") {
    await new Promise<void>((resolve) => redis.once("ready", () => resolve()));
  }
});

afterAll(async () => {
  await disconnectRedis();
});

describe("redis", () => {
  it("responds to ping", async () => {
    expect(await pingRedis()).toBe(true);
  });

  it("can set and get a key", async () => {
    await redis.set("test:key", "hello");
    const val = await redis.get("test:key");
    expect(val).toBe("hello");
    await redis.del("test:key");
  });

  it("respects TTL (EX)", async () => {
    await redis.set("test:ttl", "x", "EX", 1);
    const ttl = await redis.ttl("test:ttl");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(1);
    await redis.del("test:ttl");
  });
});