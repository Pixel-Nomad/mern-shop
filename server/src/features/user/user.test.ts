import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectDB, disconnectDB } from "../../config/db.js";
import { User } from "./user.model.js";
import { UserRole } from "./user.types.js";

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await User.deleteMany({});
  await disconnectDB();
});

beforeEach(async () => {
  await User.deleteMany({});
});

const validUser = {
  email: "test@example.com",
  password: "password123",
  name: "Test User",
};

describe("User model", () => {
  it("creates a user with hashed password", async () => {
    const user = await User.create(validUser);

    expect(user.email).toBe("test@example.com");
    expect(user.password).not.toBe("password123");
    expect(user.password).toMatch(/^\$2[aby]\$/);
    expect(user.role).toBe(UserRole.USER);
    expect(user.emailVerified).toBe(false);
  });

  it("lowercases email", async () => {
    const user = await User.create({ ...validUser, email: "MiXeD@Case.COM" });
    expect(user.email).toBe("mixed@case.com");
  });

  it("enforces unique email", async () => {
    await User.create(validUser);
    await expect(
      User.create({ ...validUser, email: "TEST@example.com" }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it("rejects invalid email", async () => {
    await expect(
      User.create({ ...validUser, email: "not-an-email" }),
    ).rejects.toThrow(/valid email/i);
  });

  it("rejects short password", async () => {
    await expect(
      User.create({ ...validUser, password: "short" }),
    ).rejects.toThrow(/at least 8/i);
  });

  it("hides password in toJSON output", async () => {
    const user = await User.create(validUser);
    const json = user.toJSON();
    expect(json).not.toHaveProperty("password");
    expect(json).not.toHaveProperty("emailVerificationToken");
    expect(json).not.toHaveProperty("twoFactorSecret");
  });

  it("does NOT return password by default query", async () => {
    await User.create(validUser);
    const user = await User.findOne({ email: "test@example.com" });
    expect(user).not.toBeNull();
    expect(user?.password).toBeUndefined();
  });

  it("returns password when explicitly selected", async () => {
    await User.create(validUser);
    const user = await User.findByEmail("test@example.com", true);
    expect(user?.password).toBeDefined();
  });

  it("comparePassword returns true for correct password", async () => {
    await User.create(validUser);
    const user = await User.findByEmail("test@example.com", true);
    const ok = await user!.comparePassword("password123");
    expect(ok).toBe(true);
  });

  it("comparePassword returns false for wrong password", async () => {
    await User.create(validUser);
    const user = await User.findByEmail("test@example.com", true);
    const ok = await user!.comparePassword("wrongpass");
    expect(ok).toBe(false);
  });

  it("does NOT rehash unchanged password on save", async () => {
    const user = await User.create(validUser);
    const originalHash = user.password;

    user.name = "New Name";
    await user.save();

    expect(user.password).toBe(originalHash);
  });

  it("isLocked returns false by default", async () => {
    const user = await User.create(validUser);
    expect(user.isLocked()).toBe(false);
  });

  it("incLoginAttempts increments and locks after 5 tries", async () => {
    const user = await User.create(validUser);
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    for (let i = 0; i < 5; i += 1) {
      await user.incLoginAttempts();
    }

    expect(user.loginAttempts).toBeGreaterThanOrEqual(5);
    expect(user.isLocked()).toBe(true);
  });
});