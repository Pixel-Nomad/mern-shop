import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../../app.js";
import { disconnectDB } from "../../../config/db.js";
import { User } from "../../user/user.model.js";

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await User.deleteMany({});
  await disconnectDB();
});

beforeEach(async () => {
  await User.deleteMany({});
});

const validPayload = {
  name: "Test User",
  email: "test@example.com",
  password: "Password123",
};

describe("POST /api/auth/signup", () => {
  it("creates a user and returns 201", async () => {
    const res = await request(app).post("/api/auth/signup").send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.user.name).toBe("Test User");
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.user).not.toHaveProperty("emailVerificationToken");

    const saved = await User.findOne({ email: "test@example.com" });
    expect(saved).not.toBeNull();
    expect(saved!.password).toBeUndefined(); // select: false
  });

  it("stores a hashed verification token", async () => {
    await request(app).post("/api/auth/signup").send(validPayload);

    const user = await User.findOne({ email: "test@example.com" }).select(
      "+emailVerificationToken +emailVerificationExpires",
    );

    expect(user!.emailVerificationToken).toBeDefined();
    // SHA-256 hex = 64 chars
    expect(user!.emailVerificationToken!.length).toBe(64);
    expect(user!.emailVerificationExpires).toBeInstanceOf(Date);
    expect(user!.emailVerificationExpires!.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validPayload, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors.email).toBeDefined();
  });

  it("rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validPayload, password: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
  });

  it("rejects weak password (no uppercase)", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validPayload, password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
  });

  it("rejects weak password (no digit)", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validPayload, password: "PasswordOnly" });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
  });

  it("rejects missing name", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "x@y.com", password: "Password123" });

    expect(res.status).toBe(400);
    expect(res.body.errors.name).toBeDefined();
  });

  it("rejects duplicate email with 409", async () => {
    await request(app).post("/api/auth/signup").send(validPayload);
    const res = await request(app).post("/api/auth/signup").send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("lowercases email automatically", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validPayload, email: "MiXeD@Case.COM" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("mixed@case.com");
  });
});