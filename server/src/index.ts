import { env } from "./config/env.js";

const bootstrap = (): void => {
  console.warn(`[server] starting in ${env.NODE_ENV} mode`);
  console.warn(`[server] listening on ${env.API_URL}`);
  console.warn(`[server] hello from MERN Shop API 👋`);
};

bootstrap();
