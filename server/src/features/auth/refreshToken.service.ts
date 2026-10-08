import { redis } from "../../config/redis.js";

/**
 * Redis key namespace for refresh tokens.
 * Pattern: refresh:<jti>  → value: JSON { userId, family }
 *
 * We ALSO keep a reverse index:
 * Pattern: refresh:user:<userId>  → SET of active jti's
 *
 * The `family` field tracks rotation lineage — used for theft detection.
 */

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

interface StoredRefreshToken {
  userId: string;
}

export const storeRefreshToken = async (
  jti: string,
  userId: string,
): Promise<void> => {
  await redis
    .multi()
    .set(`refresh:${jti}`, JSON.stringify({ userId }), "EX", REFRESH_TTL_SECONDS)
    .sadd(`refresh:user:${userId}`, jti)
    .expire(`refresh:user:${userId}`, REFRESH_TTL_SECONDS)
    .exec();
};

export const getRefreshToken = async (
  jti: string,
): Promise<StoredRefreshToken | null> => {
  const raw = await redis.get(`refresh:${jti}`);
  if (!raw) return null;
  return JSON.parse(raw) as StoredRefreshToken;
};

export const revokeRefreshToken = async (
  jti: string,
  userId: string,
): Promise<void> => {
  await redis
    .multi()
    .del(`refresh:${jti}`)
    .srem(`refresh:user:${userId}`, jti)
    .exec();
};

export const revokeAllUserRefreshTokens = async (
  userId: string,
): Promise<void> => {
  const userKey = `refresh:user:${userId}`;
  const jtis = await redis.smembers(userKey);
  if (jtis.length === 0) {
    await redis.del(userKey);
    return;
  }
  const keys = jtis.map((jti) => `refresh:${jti}`);
  await redis.del(...keys, userKey);
};