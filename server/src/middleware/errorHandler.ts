import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Central error handler — the ONE place that converts any thrown error
 * into an HTTP response. Registered last in the middleware stack.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // 1. Zod validation errors → 400 with field-level detail
  if (err instanceof ZodError) {
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  // 2. Our own AppError → use its status code
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
    return;
  }

  // 3. Mongoose duplicate key error (e.g. email already exists)
  if (isMongoDuplicateKeyError(err)) {
    const field = Object.keys(err.keyPattern)[0] ?? "field";
    res.status(409).json({
      status: "error",
      message: `${field} already exists`,
    });
    return;
  }

  // 4. Unknown error → log fully, return generic 500
  logger.error({ err }, "unhandled error");

  res.status(500).json({
    status: "error",
    message:
      env.NODE_ENV === "production"
        ? "Something went wrong"
        : err instanceof Error
          ? err.message
          : String(err),
  });
};

interface MongoDuplicateKeyError {
  code: 11000;
  keyPattern: Record<string, number>;
}

const isMongoDuplicateKeyError = (err: unknown): err is MongoDuplicateKeyError => {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000 &&
    "keyPattern" in err
  );
};