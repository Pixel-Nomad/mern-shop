import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

const log = logger.child({ name: "redis" });

/**
 * Singleton Redis client. Shared across the app.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("connect", () => log.info("connecting..."));
redis.on("ready", () => log.info("✅ ready"));
redis.on("error", (err) => log.error({ err }, "error"));
redis.on("close", () => log.warn("connection closed"));
redis.on("reconnecting", () => log.warn("reconnecting..."));

/**
 * Ping Redis. Returns true if the server responds.
 */
export const pingRedis = async (): Promise<boolean> => {
  try {
    const reply = await redis.ping();
    return reply === "PONG";
  } catch {
    return false;
  }
};

/**
 * Disconnect Redis. Used during graceful shutdown.
 */
export const disconnectRedis = async (): Promise<void> => {
  await redis.quit();
  log.info("disconnected");
};