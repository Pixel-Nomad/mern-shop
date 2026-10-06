import crypto from "node:crypto";

/**
 * Generate a cryptographically secure random hex string.
 * Used for email verification tokens, password reset tokens, etc.
 */
export const generateToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString("hex");
};

/**
 * SHA-256 hash a token for storage.
 * The raw token goes to the user's email; only the hash hits the DB.
 * If the DB leaks, the raw tokens can't be derived from the hashes.
 */
export const hashToken = (raw: string): string => {
  return crypto.createHash("sha256").update(raw).digest("hex");
};