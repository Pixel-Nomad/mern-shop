import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../../app.js";
import { disconnectDB } from "../../../config/db.js";
import { User } from "../../user/user.model.js";
import { RefreshToken } from "../refreshToken.model.js";

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

const createVerifiedUser = async () => {
  const user = await User.create({
    name: "Login Test",
    email: "login@test.com",
    password: "Password123",
    emailVerified: true,
  });
  return user;
};

describe("POST /api/auth/login", () => {
  it("logs in a verified user and sets refresh cookie", async () => {
    await createVerifiedUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "Password123" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe("login@test.com");
    expect(res.body.user).not.toHaveProperty("password");

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const refreshCookie = (cookies as unknown as string[]).find((c) =>
      c.startsWith("refreshToken="),
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  });

  it("creates a RefreshToken document", async () => {
    await createVerifiedUser();
    await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "Password123" });

    const tokens = await RefreshToken.find({});
    expect(tokens.length).toBe(1);
  });

  it("rejects invalid credentials with generic message", async () => {
    await createVerifiedUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "WrongPass1" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("rejects unknown email with the same generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "Password123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("rejects unverified users with 403", async () => {
    await User.create({
      name: "Unverified",
      email: "unverified@test.com",
      password: "Password123",
      emailVerified: false,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@test.com", password: "Password123" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify/i);
  });

  it("locks account after 5 failed attempts", async () => {
    await createVerifiedUser();

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ email: "login@test.com", password: "WrongPass1" });
    }

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "Password123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/locked/i);
  });

  it("resets login attempts on successful login", async () => {
    const user = await createVerifiedUser();

    // Fail a few times first
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ email: "login@test.com", password: "WrongPass1" });
    }

    await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "Password123" });

    const fresh = await User.findById(user._id).select("+loginAttempts +lockUntil");
    expect(fresh!.loginAttempts).toBe(0);
    expect(fresh!.lockUntil).toBeUndefined();
  });
});

describe("POST /api/auth/refresh", () => {
  it("rotates the refresh token", async () => {
    await createVerifiedUser();

    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "login@test.com", password: "Password123" });

    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith("refreshToken="));
    expect(refreshCookie).toBeDefined();

    const cookieValue = refreshCookie!.split(";")[0];
    if (!cookieValue) throw new Error("Expected refreshToken cookie");

    // Before refresh: exactly 1 token in DB
    expect(await RefreshToken.countDocuments({})).toBe(1);

    const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookieValue);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    // The critical assertion: rotation deletes old + creates new = still exactly 1.
    // If rotation were broken and just added tokens, this would be 2.
    expect(await RefreshToken.countDocuments({})).toBe(1);

    // A new Set-Cookie header was issued
    const newCookies = refreshRes.headers["set-cookie"] as unknown as string[];
    const newRefreshCookie = newCookies.find((c) =>
        c.startsWith("refreshToken="),
    );
    expect(newRefreshCookie).toBeDefined();
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user with valid access token", async () => {
    await createVerifiedUser();

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "Password123" });

    const accessToken = loginRes.body.accessToken;

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("login@test.com");
  });

  it("rejects request without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects request with invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears refresh cookie and deletes token from DB", async () => {
    await createVerifiedUser();

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "Password123" });

    const cookies = loginRes.headers["set-cookie"] as unknown as string[];

    const cookieValue = cookies
        .find((c) => c.startsWith("refreshToken="))!
        .split(";")[0];
    if (!cookieValue) {
        throw new Error("Expected refreshToken cookie");
    }

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookieValue);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers["set-cookie"]?.[0]).toMatch(/refreshToken=;/);

    const tokens = await RefreshToken.find({});
    expect(tokens.length).toBe(0);
  });
});