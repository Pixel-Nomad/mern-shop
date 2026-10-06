import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getDbState } from "../config/db.js";

export const healthRouter = Router();

/**
 * GET /api/health
 * Liveness: process is up. Cheap, never touches the DB.
 */
healthRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * GET /api/health/db
 * Readiness: DB is reachable. Returns 503 if not connected.
 */
healthRouter.get(
  "/db",
  asyncHandler(async (_req: Request, res: Response) => {
    const state = getDbState();
    const ok = state === "connected";

    res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      db: state,
      timestamp: new Date().toISOString(),
    });
  }),
);