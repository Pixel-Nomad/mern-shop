import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrap an async route handler so that rejected promises are forwarded
 * to Express's error middleware. Without this, async errors are silently
 * swallowed (pre-Express-5) or crash the process.
 *
 * Express 5 actually handles async errors natively, but this pattern
 * gives us explicit, zero-ambiguity behavior AND lets us type the
 * handler parameters precisely.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};