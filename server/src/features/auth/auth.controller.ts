import type { Request, Response } from "express";
import { signupSchema } from "./auth.validation.js";
import { signupUser } from "./auth.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import { verifyEmailSchema } from "./auth.validation.js";
import { verifyEmailUser } from "./auth.service.js";
import type { CookieOptions } from "express";
import { loginSchema } from "./auth.validation.js";
import { loginUser, rotateRefreshToken, logoutUser } from "./auth.service.js";
import { env } from "../../config/env.js";

const REFRESH_COOKIE_NAME = "refreshToken";

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 days in ms
};

const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions);
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
  });
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: 200 { status, message, accessToken, user }
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, {
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { user, accessToken, refreshToken } = await loginUser(
    parsed.data.email,
    parsed.data.password,
  );

  setRefreshCookie(res, refreshToken);

  res.status(200).json({
    status: "success",
    message: "Logged in",
    accessToken,
    user: user.toJSON(),
  });
});

/**
 * POST /api/auth/refresh
 * Body: none (refresh token is in httpOnly cookie)
 * Returns: 200 { status, accessToken, user }
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!raw) {
    throw AppError.unauthorized("No refresh token");
  }

  const { user, accessToken, refreshToken } = await rotateRefreshToken(raw);

  setRefreshCookie(res, refreshToken);

  res.status(200).json({
    status: "success",
    accessToken,
    user: user.toJSON(),
  });
});

/**
 * POST /api/auth/logout
 * Body: none (refresh token is in httpOnly cookie)
 * Returns: 200 { status, message }
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (raw) {
    await logoutUser(raw);
  }
  clearRefreshCookie(res);
  res.status(200).json({ status: "success", message: "Logged out" });
});

/** GET /api/auth/me
 * Body: none (access token is in Authorization header)
 * Returns: 200 { status, user }
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  // protect middleware guarantees req.user exists
  res.status(200).json({
    status: "success",
    user: req.user!.toJSON(),
  });
});

/**
 * POST /api/auth/signup
 * Body: { name, email, password }
 * Returns: 201 { status, message, user }
 */
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    // Pass Zod errors through the central handler (already handles ZodError)
    throw new AppError(
      "Validation failed",
      400,
      { errors: parsed.error.flatten().fieldErrors },
    );
  }

  const user = await signupUser(parsed.data);

  res.status(201).json({
    status: "success",
    message:
      "Account created. Please check your email to verify your account.",
    user: user.toJSON(),
  });
});


/**
 * POST /api/auth/verify-email
 * Body: { token }
 * Returns: 200 { status, message, user }
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const parsed = verifyEmailSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError("Validation failed", 400, {
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const user = await verifyEmailUser(parsed.data.token);

  res.status(200).json({
    status: "success",
    message: "Email verified successfully",
    user: user.toJSON(),
  });
});