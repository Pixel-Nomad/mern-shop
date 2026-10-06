import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { healthRouter } from "./routes/health.route.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authRouter } from "./features/auth/auth.routes.js";

/**
 * Create an Express app. Connects to MongoDB first.
 * If the DB is unreachable (after retries), the promise rejects
 * and startup fails — better to crash than serve a broken API.
 */
export const createApp = async (): Promise<express.Express> => {
  await connectDB();

  const app = express();

  // Trust first proxy (nginx, heroku router, etc.) so req.ip is correct.
  app.set("trust proxy", 1);

  // ─── Request ID (must be first so everything else can use it) ──
  app.use(requestId);

  // ─── Logging ───────────────────────────────────────────────────
  app.use(requestLogger);

  // ─── Security & Utility Middleware ─────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // ─── Body Parsers ──────────────────────────────────────────────
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));

  // ─── Routes ────────────────────────────────────────────────────
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  // app.post("/api/debug-log", (req, res) => {
  //   logger.info({ body: req.body }, "debug logging test");
  //   res.json({ ok: true });
  // });
  // ─── 404 + Error Handling (must be last) ───────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
};