import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../app.js";
import { disconnectDB } from "../config/db.js";
import { logger } from "../config/logger.js";

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await disconnectDB();
});

describe("logging", () => {
  it("logger is silent in test env", () => {
    expect(logger.level).toBe("silent");
  });

  it("logger has a child API", () => {
    const child = logger.child({ name: "test" });
    expect(child).toBeDefined();
    expect(child.level).toBe("silent");
  });

  it("adds an x-request-id response header", async () => {
    const res = await request(app).get("/api/health");
    const header = res.headers["x-request-id"];
    expect(header).toBeDefined();
    expect(typeof header).toBe("string");
  });

  it("honors an incoming x-request-id header", async () => {
    const incoming = "test-request-id-12345";
    const res = await request(app)
      .get("/api/health")
      .set("X-Request-ID", incoming);
    expect(res.headers["x-request-id"]).toBe(incoming);
  });

  it("generates a new request id when none provided", async () => {
    const res = await request(app).get("/api/health");
    const header = res.headers["x-request-id"] as string;
    // UUID v4 format check: 8-4-4-4-12 hex chars
    expect(header).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});