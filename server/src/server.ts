import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectDB } from "./config/db.js";

const bootstrap = async (): Promise<void> => {
  const app = await createApp();

  const server = app.listen(env.PORT, () => {
    console.warn(
      `[server] ✅ listening on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`,
    );
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.warn(`[server] received ${signal}, shutting down...`);

    const forceExit = setTimeout(() => {
      console.error("[server] forced shutdown after 10s");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await disconnectDB();
      console.warn("[server] closed cleanly");
      process.exit(0);
    } catch (err) {
      console.error("[server] error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

bootstrap().catch((err: unknown) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});