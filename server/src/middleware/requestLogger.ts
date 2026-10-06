import { pinoHttp } from "pino-http";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

/**
 * Logs every HTTP request using Pino.
 * Custom serializers keep log entries focused and small.
 */
export const requestLogger = pinoHttp({
  logger,

  // Use our pre-existing request ID (set by requestId middleware).
  genReqId: (req) => {
    const r = req as { id?: string };
    return r.id ?? "unknown";
  },

  // Only log requests in dev + prod. Silent in test.
  autoLogging: {
    ignore: () => env.NODE_ENV === "test",
  },

  // Trim what gets serialized from req/res.
  serializers: {
    req(req: { id?: string; method?: string; url?: string }) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
      };
    },
    res(res: { statusCode?: number }) {
      return {
        statusCode: res.statusCode,
      };
    },
  },

  // Log levels per outcome.
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },

  // Log message format.
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode}`,

  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ✗ ${res.statusCode}`,
});