import { afterAll, beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../app.js";
import { disconnectDB } from "../config/db.js";

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await disconnectDB();
});

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("sets security headers from helmet", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("sets CORS headers for allowed origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("GET /api/health/db", () => {
  it("returns 200 when DB is connected", async () => {
    const res = await request(app).get("/api/health/db");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("connected");
  });
});