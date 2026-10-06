import { afterAll, beforeAll, describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { connectDB, disconnectDB, getDbState, DB_STATES } from "../config/db.js";

describe("db connection", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it("connects and reports 'connected'", () => {
    expect(mongoose.connection.readyState).toBe(1);
    expect(getDbState()).toBe("connected");
  });

  it("exposes all DB states", () => {
    expect(DB_STATES[0]).toBe("disconnected");
    expect(DB_STATES[1]).toBe("connected");
    expect(DB_STATES[2]).toBe("connecting");
    expect(DB_STATES[3]).toBe("disconnecting");
  });

  it("can ping the database", async () => {
    const result = await mongoose.connection.db?.admin().command({ ping: 1 });
    expect(result?.ok).toBe(1);
  });

  it("reports 'disconnected' after disconnect", async () => {
    await disconnectDB();
    expect(getDbState()).toBe("disconnected");
    // Reconnect for the afterAll disconnect
    await connectDB();
  });
});