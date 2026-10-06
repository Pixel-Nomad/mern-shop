import { User } from "../user/user.model.js";
import type { IUserDocument } from "../user/user.model.js";
import { AppError } from "../../utils/AppError.js";
import { generateToken, hashToken } from "../../utils/crypto.js";
import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import type { SignupInput } from "./auth.validation.js";

const log = logger.child({ name: "auth.service" });

/**
 * Create a new user and generate a verification token.
 * Returns the user document (raw token NOT included — see below).
 */
export const signupUser = async (
  input: SignupInput,
): Promise<IUserDocument> => {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw AppError.conflict("An account with this email already exists");
  }

  const user = await User.create({
    email: input.email,
    password: input.password,
    name: input.name,
  });

  const rawToken = generateToken(32);
  user.emailVerificationToken = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  // TODO(commit #9): send email with verification URL
  const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;
  log.info(
    { userId: user._id.toString(), verificationUrl },
    "🔗 verification URL (dev only — email sending in commit #9)",
  );

  return user;
};