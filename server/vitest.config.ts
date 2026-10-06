import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    poolOptions: {
      threads: { singleThread: true },
    },
  },
});