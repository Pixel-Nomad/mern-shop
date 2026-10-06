import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Attaches a unique ID to every request. If the client sends one
 * (via X-Request-ID), we honor it — useful for distributed tracing
 * where an upstream proxy or service already generated one.
 */
export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();

  // Attach to the request so downstream middleware/handlers can use it.
  (req as Request & { id: string }).id = id;
  res.setHeader("x-request-id", id);

  next();
};