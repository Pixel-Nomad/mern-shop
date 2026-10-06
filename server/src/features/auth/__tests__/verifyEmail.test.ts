import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../../app.js";
import { disconnectDB } from "../../../config/db.js";
import { User } from "../../user/user.model.js";
import { generateToken, hashToken } from "../../../utils/crypto.js";

let app: Express;

// Mock the sendEmail function so tests don't actually hit Resend.
vi.mock("../../../config/email.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

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

const makeUser = async (overrides: Partial<{ emailVerified: boolean }> = {}) => {
  const rawToken = generateToken(32);
  const user = await User.create({
    name: "Verify Test",
    email: "verify@test.com",
    password: "Password123",
  });
  user.emailVerificationToken = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + 60 * 60 * 1000);
  user.emailVerified = overrides.emailVerified ?? false;
  await user.save();
  return { user, rawToken };
};

describe("POST /api/auth/verify-email", () => {
  it("verifies a user with a valid token", async () => {
    const { rawToken } = await makeUser();

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: rawToken });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.user.emailVerified).toBe(true);

    const dbUser = await User.findOne({ email: "verify@test.com" });
    expect(dbUser!.emailVerified).toBe(true);
  });

  it("clears the verification token after success", async () => {
    const { rawToken } = await makeUser();

    await request(app).post("/api/auth/verify-email").send({ token: rawToken });

    const dbUser = await User.findOne({ email: "verify@test.com" }).select(
      "+emailVerificationToken +emailVerificationExpires",
    );
    expect(dbUser!.emailVerificationToken).toBeUndefined();
    expect(dbUser!.emailVerificationExpires).toBeUndefined();
  });

  it("returns 400 for an invalid token", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "deadbeef".repeat(8) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it("returns 400 for an expired token", async () => {
    const { user, rawToken } = await makeUser();
    user.emailVerificationExpires = new Date(Date.now() - 1000);
    await user.save();

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: rawToken });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("clears the token when it expires", async () => {
    const { user, rawToken } = await makeUser();
    user.emailVerificationExpires = new Date(Date.now() - 1000);
    await user.save();

    await request(app).post("/api/auth/verify-email").send({ token: rawToken });

    const dbUser = await User.findOne({ email: "verify@test.com" }).select(
      "+emailVerificationToken +emailVerificationExpires",
    );
    expect(dbUser!.emailVerificationToken).toBeUndefined();
  });

  it("is idempotent — second verify succeeds", async () => {
    const { rawToken } = await makeUser();

    const first = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: rawToken });
    expect(first.status).toBe(200);

    // Token is now cleared, so a second attempt with the same token should fail
    const second = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: rawToken });
    expect(second.status).toBe(400);
  });

  it("rejects missing token", async () => {
    const res = await request(app).post("/api/auth/verify-email").send({});
    expect(res.status).toBe(400);
    expect(res.body.errors.token).toBeDefined();
  });

  it("rejects non-hex token", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "not!!valid!!token" });
    expect(res.status).toBe(400);
    expect(res.body.errors.token).toBeDefined();
  });
});