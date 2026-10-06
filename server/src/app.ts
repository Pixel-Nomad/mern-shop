import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.route.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const createApp = (): express.Express => {
  const app = express();

  // Trust first proxy (nginx, heroku router, etc.) so req.ip is correct.
  app.set("trust proxy", 1);

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

  // ─── HTTP Logging ──────────────────────────────────────────────
  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  // ─── Routes ────────────────────────────────────────────────────
  app.use("/api/health", healthRouter);

  // ─── 404 + Error Handling (must be last) ───────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
};