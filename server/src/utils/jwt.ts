import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Payload embedded in our JWTs.
 * Keep this small — JWTs are base64, not encrypted.
 */
export interface JwtPayload {
  sub: string;      // subject = userId
  email: string;
  role: "user" | "admin";
  type: "access" | "refresh";
}

export const signAccessToken = (payload: Omit<JwtPayload, "type">): string => {
  return jwt.sign(
    { ...payload, type: "access" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as SignOptions,
  );
};

export const signRefreshToken = (payload: Omit<JwtPayload, "type">): string => {
  return jwt.sign(
    { ...payload, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as SignOptions,
  );
};

/**
 * Verify an access token. Throws if invalid or expired.
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  if (decoded.type !== "access") {
    throw new Error("Not an access token");
  }
  return decoded;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  if (decoded.type !== "refresh") {
    throw new Error("Not a refresh token");
  }
  return decoded;
};