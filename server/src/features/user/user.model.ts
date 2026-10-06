import { Schema, model } from "mongoose";
import type { HydratedDocument, Model, Types } from "mongoose";
import bcrypt from "bcrypt";
import {
  UserRole,
  type OAuthAccount,
  type TwoFactorMethod,
} from "./user.types.js";

/**
 * Document interface — describes what a User instance looks like.
 * "Document" in Mongoose = a single record with methods attached.
 */
export interface IUser {
  _id: Types.ObjectId;
  email: string;
  password?: string | undefined;
  name: string;
  role: UserRole;
  avatarUrl?: string | undefined;

  emailVerified: boolean;
  emailVerificationToken?: string | undefined;
  emailVerificationExpires?: Date | undefined;

  passwordResetToken?: string | undefined;
  passwordResetExpires?: Date | undefined;

  twoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod;
  twoFactorSecret?: string | undefined;

  oauthAccounts: OAuthAccount[];

  lastLoginAt?: Date;
  loginAttempts: number;
  lockUntil?: Date | undefined;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Instance methods — available on every User document.
 */
export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
  isLocked(): boolean;
  incLoginAttempts(): Promise<IUserDocument>;
}

/**
 * Static methods — available on the User model itself.
 */
export interface IUserModel extends Model<IUser, Record<string, never>, IUserMethods> {
  findByEmail(email: string, includePassword?: boolean): Promise<IUserDocument | null>;
}

/**
 * The hydrated document type — what `new User()` and `User.findOne()` return.
 */
export type IUserDocument = HydratedDocument<IUser, IUserMethods>;

/**
 * The schema. Defines the shape of documents in the DB.
 */
const userSchema = new Schema<IUser, IUserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name must be at most 80 characters"],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    avatarUrl: {
      type: String,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorMethod: {
      type: String,
      enum: ["totp", "email", null],
      default: null,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },

    oauthAccounts: [
      {
        provider: {
          type: String,
          enum: ["google", "discord", "facebook"],
          required: true,
        },
        providerId: {
          type: String,
          required: true,
        },
        linkedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    lastLoginAt: { type: Date },
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.password;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.twoFactorSecret;
        delete ret.loginAttempts;
        delete ret.lockUntil;
      },
    },
    toObject: { virtuals: true },
  },
);

/**
 * Index: ensure no two users can share the same (provider, providerId).
 * Sparse so users without OAuth aren't affected.
 */
userSchema.index(
  { "oauthAccounts.provider": 1, "oauthAccounts.providerId": 1 },
  { sparse: true, unique: true },
);

/**
 * Hash password before saving — ONLY if it changed.
 * Runs on create and on any save where password is modified.
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (!this.password) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * comparePassword — bcrypt.compare is timing-safe.
 */
userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

/**
 * isLocked — true if account is currently locked out.
 */
userSchema.methods.isLocked = function (): boolean {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

/**
 * incLoginAttempts — increment attempts; lock for 30 minutes after 5 failures.
 */
userSchema.methods.incLoginAttempts = async function (): Promise<IUserDocument> {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME_MS = 30 * 60 * 1000;

  if (this.lockUntil && this.lockUntil.getTime() < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
    return this.save();
  }

  this.loginAttempts += 1;
  if (this.loginAttempts >= MAX_ATTEMPTS && !this.lockUntil) {
    this.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
  }
  return this.save();
};

/**
 * Static: findByEmail — lookup helper, optionally including password.
 */
userSchema.statics.findByEmail = function (
  this: IUserModel,
  email: string,
  includePassword = false,
) {
  const query = this.findOne({ email: email.toLowerCase() });
  if (includePassword) query.select("+password");
  return query.exec();
};

export const User = model<IUser, IUserModel>("User", userSchema);