import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * State enum — mirrors mongoose.ConnectionStates.
 * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export const DB_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
} as const;

/**
 * Wait for the current connection to be ready.
 * Used by health checks and tests.
 */
export const getDbState = (): string => {
  const state = mongoose.connection.readyState as keyof typeof DB_STATES;
  return DB_STATES[state] ?? "unknown";
};

/**
 * Connect to MongoDB with retry logic.
 * Called once at app startup. If it eventually fails, we throw
 * and the process exits — a server without a DB is useless.
 */
export const connectDB = async (
  retries = 5,
  delayMs = 2000,
): Promise<void> => {
  const attempt = (n: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      mongoose
        .connect(env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          minPoolSize: 2,
          autoIndex: env.NODE_ENV !== "production",
        })
        .then(() => resolve())
        .catch((err: unknown) => {
          if (n <= 1) {
            reject(err);
            return;
          }
          const remaining = n - 1;
          console.warn(
            `[db] connection failed, retrying in ${delayMs}ms (${remaining} attempts left)`,
          );
          setTimeout(() => {
            attempt(remaining).then(resolve, reject);
          }, delayMs);
        });
    });
  };

  console.warn(`[db] connecting to MongoDB...`);
  await attempt(retries);
  console.warn(`[db] ✅ connected`);
};

/**
 * Disconnect cleanly. Used during graceful shutdown.
 */
export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
  console.warn(`[db] disconnected`);
};

// ─── Connection event listeners (for observability) ──────────────
mongoose.connection.on("connected", () => {
  console.warn("[db] event: connected");
});

mongoose.connection.on("disconnected", () => {
  console.warn("[db] event: disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.warn("[db] event: reconnected");
});

mongoose.connection.on("error", (err: unknown) => {
  console.error("[db] event: error", err);
});