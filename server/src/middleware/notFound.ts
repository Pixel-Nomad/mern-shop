import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";

/**
 * Catch-all handler for unmatched routes. Runs after ALL other routes
 * because Express matches middlewares in registration order.
 */
export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};