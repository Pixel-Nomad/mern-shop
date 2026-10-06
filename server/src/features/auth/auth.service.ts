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
import { RefreshToken } from "./refreshToken.model.js";
import ms from "ms";
import bcrypt from "bcrypt";

interface AuthResult {
  user: IUserDocument;
  accessToken: string;
  refreshToken: string;
}

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

  // Store refresh token hash in DB
  const ttlMs = ms(env.JWT_REFRESH_EXPIRES_IN);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + ttlMs),
  });

  log.info({ userId: user._id.toString() }, "user logged in");

  return { user, accessToken, refreshToken };
};

/**
 * Rotate refresh tokens — verify, revoke old, issue new pair.
 */
export const rotateRefreshToken = async (rawRefreshToken: string): Promise<AuthResult> => {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw AppError.unauthorized("Invalid refresh token");
  }

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) {
    // Token is valid but not in DB — could be reuse after rotation.
    // Revoke ALL of this user's refresh tokens (defense against token theft).
    await RefreshToken.deleteMany({ userId: payload.sub });
    throw AppError.unauthorized("Refresh token not recognized");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    await RefreshToken.deleteOne({ _id: stored._id });
    throw AppError.unauthorized("User no longer exists");
  }

  // Rotate: delete old, issue new
  await RefreshToken.deleteOne({ _id: stored._id });

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

  const ttlMs = ms(env.JWT_REFRESH_EXPIRES_IN);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: new Date(Date.now() + ttlMs),
  });

  return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

/**
 * Logout — delete the refresh token from DB.
 */
export const logoutUser = async (rawRefreshToken: string): Promise<void> => {
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.deleteOne({ tokenHash });
  log.info("user logged out");
};