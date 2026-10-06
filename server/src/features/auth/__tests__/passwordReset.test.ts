import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../../app.js";
import { disconnectDB } from "../../../config/db.js";
import { User } from "../../user/user.model.js";
import { RefreshToken } from "../refreshToken.model.js";
import { generateToken, hashToken } from "../../../utils/crypto.js";

vi.mock("../../../config/email.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  await disconnectDB();
});

beforeEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

const createUser = async () => {
  return User.create({
    name: "Reset Test",
    email: "reset@test.com",
    password: "OldPassword123",
    emailVerified: true,
  });
};

const attachResetToken = async (email: string) => {
  const rawToken = generateToken(32);
  const user = await User.findOne({ email });
  user!.passwordResetToken = hashToken(rawToken);
  user!.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user!.save();
  return rawToken;
};

describe("POST /api/auth/forgot-password", () => {
  it("returns 200 for a valid email", async () => {
    await createUser();

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "reset@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);

    const user = await User.findOne({ email: "reset@test.com" }).select(
      "+passwordResetToken +passwordResetExpires",
    );
    expect(user!.passwordResetToken).toBeDefined();
    expect(user!.passwordResetExpires).toBeInstanceOf(Date);
  });

  it("returns the SAME response for a non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it("rejects invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBeDefined();
  });
});

describe("POST /api/auth/reset-password", () => {
  it("resets the password with a valid token", async () => {
    await createUser();
    const rawToken = await attachResetToken("reset@test.com");

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "NewPassword456" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password reset/i);

    // Can log in with the new password
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "reset@test.com", password: "NewPassword456" });
    expect(loginRes.status).toBe(200);

    // Old password no longer works
    const oldLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "reset@test.com", password: "OldPassword123" });
    expect(oldLoginRes.status).toBe(401);
  });

  it("clears the reset token after success", async () => {
    await createUser();
    const rawToken = await attachResetToken("reset@test.com");

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "NewPassword456" });

    const user = await User.findOne({ email: "reset@test.com" }).select(
      "+passwordResetToken +passwordResetExpires",
    );
    expect(user!.passwordResetToken).toBeUndefined();
    expect(user!.passwordResetExpires).toBeUndefined();
  });

  it("rejects invalid token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "deadbeef".repeat(8), password: "NewPassword456" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it("rejects expired token", async () => {
    await createUser();
    const rawToken = await attachResetToken("reset@test.com");
    await User.updateOne(
      { email: "reset@test.com" },
      { $set: { passwordResetExpires: new Date(Date.now() - 1000) } },
    );

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "NewPassword456" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("rejects weak new password", async () => {
    await createUser();
    const rawToken = await attachResetToken("reset@test.com");

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
  });

  it("revokes all refresh tokens on successful reset", async () => {
    await createUser();

    // Login to get a refresh token
    await request(app)
      .post("/api/auth/login")
      .send({ email: "reset@test.com", password: "OldPassword123" });

    const tokensBefore = await RefreshToken.countDocuments({});
    expect(tokensBefore).toBeGreaterThan(0);

    const rawToken = await attachResetToken("reset@test.com");
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "NewPassword456" });

    const tokensAfter = await RefreshToken.countDocuments({});
    expect(tokensAfter).toBe(0);
  });

  it("resets login attempts and lockout", async () => {
    const user = await createUser();
    user.loginAttempts = 10;
    user.lockUntil = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const rawToken = await attachResetToken("reset@test.com");
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "NewPassword456" });

    const fresh = await User.findById(user._id).select("+loginAttempts +lockUntil");
    expect(fresh!.loginAttempts).toBe(0);
    expect(fresh!.lockUntil).toBeUndefined();
  });
});