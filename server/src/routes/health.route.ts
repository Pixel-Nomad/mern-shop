import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/**
 * GET /api/health
 * Liveness check. Returns 200 + uptime if the process is alive.
 * Used by load balancers, Docker healthchecks, and monitoring.
 */
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }),
);
export const healthRouter = router;