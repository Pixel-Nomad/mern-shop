import { User } from "../user/user.model.js";
import type { IUserDocument } from "../user/user.model.js";
import { AppError } from "../../utils/AppError.js";
import { generateToken, hashToken } from "../../utils/crypto.js";
import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import type { SignupInput } from "./auth.validation.js";
import { sendEmail } from "../../config/email.js";
import { verifyEmailTemplate } from "./emailTemplates/index.js";


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

  const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;
  const template = verifyEmailTemplate({
    name: user.name,
    verificationUrl,
  });

  await sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  return user;
};

/**
 * Verify a user's email using the raw token from the URL.
 * Returns the verified user on success.
 * Throws 400 for invalid/expired token.
 */
export const verifyEmailUser = async (
  rawToken: string,
): Promise<IUserDocument> => {
  const hashed = hashToken(rawToken);

  const user = await User.findOne({
    emailVerificationToken: hashed,
  }).select("+emailVerificationToken +emailVerificationExpires");

  if (!user) {
    throw AppError.badRequest("Invalid or expired verification token");
  }

  if (
    !user.emailVerificationExpires ||
    user.emailVerificationExpires.getTime() < Date.now()
  ) {
    // Clear the stale token — user will need to request a new one.
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    throw AppError.badRequest("Verification token has expired");
  }

  if (user.emailVerified) {
    // Idempotent — clicking the link twice is fine.
    return user;
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  log.info({ userId: user._id.toString() }, "email verified");

  return user;
};