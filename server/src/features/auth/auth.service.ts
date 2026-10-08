import { User } from "../user/user.model.js";
import type { IUserDocument } from "../user/user.model.js";
import { AppError } from "../../utils/AppError.js";
import { generateToken, hashToken } from "../../utils/crypto.js";
import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import type { SignupInput } from "./auth.validation.js";
import { sendEmail } from "../../config/email.js";
import { verifyEmailTemplate } from "./emailTemplates/index.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import bcrypt from "bcrypt";
import { forgotPasswordTemplate } from "./emailTemplates/index.js";
import { storeRefreshToken, getRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens } from "./refreshToken.service.js";
import type { JwtPayload } from "../../utils/jwt.js";

interface AuthResult {
  user: IUserDocument;
  accessToken: string;
  refreshToken: string;
}

const log = logger.child({ name: "auth.service" });

const PASSWORD_RESET_EXPIRY_MINUTES = 30;

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

/**
 * Log in a user. Returns user + tokens on success.
 */
export const loginUser = async (
  email: string,
  password: string,
): Promise<AuthResult> => {
  // .select("+password") because it's `select: false`
  const user = await User.findOne({ email }).select("+password +loginAttempts +lockUntil");

  // Same generic error for "no user" and "wrong password" — enumeration resistance
  const genericError = AppError.unauthorized("Invalid email or password");

  if (!user) {
    // Do a dummy bcrypt compare to equalize timing
    await bcrypt.compare(password, "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    throw genericError;
  } 

  if (user.isLocked()) {
    throw AppError.unauthorized(
      "Account temporarily locked due to too many failed attempts",
    );
  }

  if (!user.password) {
    throw genericError;
  }

  const passwordOk = await user.comparePassword(password);
  if (!passwordOk) {
    await user.incLoginAttempts();
    throw genericError;
  }

  if (!user.emailVerified) {
    throw AppError.forbidden("Please verify your email first");
  }

  // Reset login attempts on success
  if (user.loginAttempts > 0 || user.lockUntil) {
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const decoded = verifyRefreshToken(refreshToken);
  const jti = decoded.jti;
  if (!jti) throw AppError.internal("Missing jti on refresh token");

  await storeRefreshToken(jti, user._id.toString());

  return { user, accessToken, refreshToken };
};

/**
 * Rotate refresh tokens — verify, revoke old, issue new pair.
 */
export const rotateRefreshToken = async (rawRefreshToken: string): Promise<AuthResult> => {
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw AppError.unauthorized("Invalid refresh token");
  }

  const jti = payload.jti;
  if (!jti) throw AppError.unauthorized("Invalid refresh token");

  const stored = await getRefreshToken(jti);
  if (!stored) {
    // Token valid but not in Redis → either expired, logged out, or reused.
    // Revoke ALL of this user's tokens defensively.
    await revokeAllUserRefreshTokens(payload.sub);
    throw AppError.unauthorized("Refresh token not recognized");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    await revokeRefreshToken(jti, payload.sub);
    throw AppError.unauthorized("User no longer exists");
  }

  // Rotate: revoke old, issue new
  await revokeRefreshToken(jti, payload.sub);

  const newAccessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  const newRefreshToken = signRefreshToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  const newDecoded = verifyRefreshToken(newRefreshToken);
  const newJti = newDecoded.jti;
  if (!newJti) throw AppError.internal("Missing jti on refresh token");

  await storeRefreshToken(newJti, user._id.toString());

  return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

/**
 * Logout — delete the refresh token from DB.
 */
export const logoutUser = async (rawRefreshToken: string): Promise<void> => {
  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    if (payload.jti) {
      await revokeRefreshToken(payload.jti, payload.sub);
    }
  } catch {
    // Token was invalid/malformed — nothing to revoke.
  }
  log.info("user logged out");
};

/**
 * Generate a password reset token and email it.
 * ALWAYS succeeds (from the caller's perspective) — never reveals if the email exists.
 */
export const forgotPasswordUser = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });

  // ⚠️ SECURITY: Do NOT throw if user not found. Return silently.
  // This prevents account enumeration via password reset.
  if (!user) {
    // Burn a small amount of time to equalize timing with the real path
    await new Promise((resolve) => setTimeout(resolve, 100));
    return;
  }

  const rawToken = generateToken(32);
  user.passwordResetToken = hashToken(rawToken);
  user.passwordResetExpires = new Date(
    Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
  );
  await user.save();

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;
  const template = forgotPasswordTemplate({
    name: user.name,
    resetUrl,
    expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
  });

  await sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  log.info({ userId: user._id.toString() }, "password reset email sent");
};

/**
 * Reset a user's password using a valid token.
 * Also revokes all refresh tokens — critical for security.
 */
export const resetPasswordUser = async (
  rawToken: string,
  newPassword: string,
): Promise<IUserDocument> => {
  const hashed = hashToken(rawToken);

  const user = await User.findOne({
    passwordResetToken: hashed,
  }).select("+passwordResetToken +passwordResetExpires +password +loginAttempts +lockUntil");

  if (!user) {
    throw AppError.badRequest("Invalid or expired reset token");
  }

  if (
    !user.passwordResetExpires ||
    user.passwordResetExpires.getTime() < Date.now()
  ) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    throw AppError.badRequest("Reset token has expired");
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.loginAttempts = 0;
  user.lockUntil = undefined;

  await user.save();

  // Revoke all refresh tokens for this user — force re-login everywhere.
  await revokeAllUserRefreshTokens(user._id.toString());

  log.info({ userId: user._id.toString() }, "password reset successful");

  return user;
};