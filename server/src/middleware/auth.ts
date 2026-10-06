import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { User } from "../features/user/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { UserRole } from "../features/user/user.types.js";

/**
 * Require a valid access token. Attaches req.user on success.
 */
export const protect = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    let token: string | undefined;

    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      token = header.slice(7);   // remove "Bearer "
    }

    if (!token) {
      throw AppError.unauthorized("You are not logged in");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw AppError.unauthorized("Invalid or expired token");
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw AppError.unauthorized("User no longer exists");
    }

    req.user = user;
    next();
  },
);

/**
 * Restrict route to specific roles. Must run after protect.
 */
export const restrictTo =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized("You are not logged in"));
    }
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden("You do not have permission"));
    }
    next();
  };