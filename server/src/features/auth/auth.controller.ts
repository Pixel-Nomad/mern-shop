import type { Request, Response } from "express";
import { signupSchema } from "./auth.validation.js";
import { signupUser } from "./auth.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";

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