import { describe, it, expect } from "vitest";

describe("env config", () => {
  it("loads a valid environment", async () => {
    const { env } = await import("./config/env.js");

    expect(["development", "test", "production"]).toContain(env.NODE_ENV);
    expect(typeof env.PORT).toBe("number");
    expect(env.PORT).toBeGreaterThan(0);
    expect(env.MONGODB_URI).toBeTruthy();
    expect(env.REDIS_URL).toBeTruthy();
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("has a working test environment", () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
