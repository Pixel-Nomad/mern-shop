import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.warn(`[server] ✅ listening on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
});

/**
 * Graceful shutdown: stop accepting new connections,
 * let in-flight requests finish (up to 10s), then exit.
 */
const shutdown = (signal: NodeJS.Signals): void => {
  console.warn(`[server] received ${signal}, shutting down...`);

  server.close((err) => {
    if (err) {
      console.error("[server] error during shutdown:", err);
      process.exit(1);
    }
    console.warn("[server] closed cleanly");
    process.exit(0);
  });

  // Hard deadline: if close() hangs, force exit after 10s.
  setTimeout(() => {
    console.error("[server] forced shutdown after 10s");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);