import { RateLimiterRedis, RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../config/logger.js";

const log = logger.child({ name: "rateLimit" });

const isTest = env.NODE_ENV === "test";

type Limiter = RateLimiterRedis | RateLimiterMemory;

/**
 * Build a rate limiter backed by Redis (prod/dev) or memory (test).
 */
const buildLimiter = (
  points: number,
  duration: number,
  blockDuration = 0,
): Limiter => {
  if (isTest) {
    return new RateLimiterMemory({ points, duration, blockDuration });
  }
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl",
    points,
    duration,
    blockDuration,
  });
};

/**
 * Wrap a limiter as Express middleware.
 */
const makeMiddleware = (
  limiter: Limiter,
  keyGenerator: (req: Request) => string = (req) => req.ip ?? "unknown",
): RequestHandler => {
  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      const result: RateLimiterRes = await limiter.consume(key);

      res.setHeader("X-RateLimit-Limit", limiter.points);
      res.setHeader("X-RateLimit-Remaining", result.remainingPoints);
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(Date.now() + result.msBeforeNext).toISOString(),
      );

      next();
    } catch (rejRes) {
      if (rejRes instanceof Error) {
        log.error({ err: rejRes }, "rate limiter error");
        return next(rejRes);
      }

      const msBeforeNext = (rejRes as RateLimiterRes).msBeforeNext;
      const retryAfterSec = Math.ceil(msBeforeNext / 1000);
      res.setHeader("Retry-After", retryAfterSec);

      return next(
        new AppError("Too many requests. Please try again later.", 429),
      );
    }
  };
};

/**
 * A no-op middleware used in tests. Always calls next().
 * Real rate limiting behavior is tested separately by building a
 * limiter directly (see rateLimit.test.ts).
 */
const noopMiddleware: RequestHandler = (_req, _res, next) => next();

// ─── Production limiters ────────────────────────────────────────

const globalLimiterImpl = makeMiddleware(buildLimiter(100, 15 * 60));
const authLimiterImpl = makeMiddleware(buildLimiter(10, 15 * 60, 15 * 60));
const strictLimiterImpl = makeMiddleware(buildLimiter(5, 60 * 60));

const loginEmailLimiterImpl = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const email = (req.body as { email?: string })?.email ?? "unknown";
  const limiter = buildLimiter(5, 15 * 60, 15 * 60);
  return makeMiddleware(limiter, () => `${email}:${req.ip ?? "unknown"}`)(
    req,
    res,
    next,
  ) as void;
};

// ─── Exports (no-ops in test) ───────────────────────────────────

export const globalLimiter: RequestHandler = isTest
  ? noopMiddleware
  : globalLimiterImpl;

export const authLimiter: RequestHandler = isTest
  ? noopMiddleware
  : authLimiterImpl;

export const strictLimiter: RequestHandler = isTest
  ? noopMiddleware
  : strictLimiterImpl;

export const loginEmailLimiter: RequestHandler = isTest
  ? noopMiddleware
  : loginEmailLimiterImpl;

// ─── Test helpers (exported for rateLimit.test.ts) ──────────────

export const __test__ = {
  buildLimiter,
  makeMiddleware,
};