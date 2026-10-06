import { pino } from "pino";
import { env } from "./env.js";

const isProduction = env.NODE_ENV === "production";
const isTest = env.NODE_ENV === "test";
const usePrettyTransport = !isProduction && !isTest;

export const logger = pino({
  level: isTest ? "silent" : isProduction ? "info" : "debug",

  // Only include transport in dev. In prod we emit raw JSON (fast).
  // In tests we're silent, so no transport needed.
  //
  // We use conditional spread (`...(cond ? { x } : {})`) instead of
  // `transport: cond ? {...} : undefined` because `exactOptionalPropertyTypes`
  // forbids explicitly assigning `undefined` to an optional property.
  ...(usePrettyTransport
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
            singleLine: false,
          },
        },
      }
    : {}),

  base: {
    service: "mern-shop-api",
    env: env.NODE_ENV,
  },

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.passwordConfirm",
      "req.body.token",
      "*.password",
      "*.token",
      "*.secret",
    ],
    censor: "[Redacted]",
  },

  timestamp: pino.stdTimeFunctions.isoTime,
});

export const createChildLogger = (name: string) => logger.child({ name });