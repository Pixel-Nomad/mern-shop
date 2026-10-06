import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { errorHandler } from "../middleware/errorHandler.js";
import { notFound } from "../middleware/notFound.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Build a tiny app with test-only routes to prove error handling works.
 * We don't touch the real app.ts because we want to isolate behavior.
 */
const buildTestApp = () => {
  const app = express();
  app.use(express.json());

  app.get(
    "/bad-request",
    asyncHandler(async () => {
      throw AppError.badRequest("You messed up");
    }),
  );

  app.get(
    "/teapot",
    asyncHandler(async () => {
      throw new AppError("I'm a teapot", 418);
    }),
  );

  app.get(
    "/crash",
    asyncHandler(async () => {
      throw new Error("unexpected kaboom");
    }),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
};

const app = buildTestApp();

describe("error handling", () => {
  it("returns 400 for AppError.badRequest", async () => {
    const res = await request(app).get("/bad-request");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      status: "error",
      message: "You messed up",
    });
  });

  it("returns custom status code (418) for arbitrary AppError", async () => {
    const res = await request(app).get("/teapot");
    expect(res.status).toBe(418);
    expect(res.body.message).toBe("I'm a teapot");
  });

  it("returns 500 for unknown errors", async () => {
    const res = await request(app).get("/crash");
    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    // In test env, NODE_ENV !== 'production', so message IS exposed
    expect(res.body.message).toBe("unexpected kaboom");
  });

  it("returns 404 for unmatched routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("/nope");
  });
});