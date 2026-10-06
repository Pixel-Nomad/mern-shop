import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectDB } from "./config/db.js";
import { logger } from "./config/logger.js";

const log = logger.child({ name: "server" });

const bootstrap = async (): Promise<void> => {
  const app = await createApp();

  const server = app.listen(env.PORT, () => {
    log.info(
      { port: env.PORT, env: env.NODE_ENV },
      "✅ API listening",
    );
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    log.warn({ signal }, "shutting down");

    const forceExit = setTimeout(() => {
      log.error("forced shutdown after 10s");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await disconnectDB();
      log.info("closed cleanly");
      process.exit(0);
    } catch (err) {
      log.error({ err }, "error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

bootstrap().catch((err: unknown) => {
  log.error({ err }, "failed to start");
  process.exit(1);
});