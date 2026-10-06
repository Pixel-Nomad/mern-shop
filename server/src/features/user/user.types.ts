/**
 * User roles. Kept as a const object + union type so we get
 * both runtime values (for validation) and compile-time types.
 */
export const UserRole = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
//                      ▲        ▲        ▲
//                      │        │        └── "user" | "admin"
//                      │        └── the keys of the object: "USER" | "ADMIN"
//                      └── typeof on a value gives its type

/**
 * 2FA method — for the "which 2FA is active" field.
 * Null = not enabled.
 */
export type TwoFactorMethod = "totp" | "email" | null;

/**
 * OAuth providers we support. Matches Passport strategy names.
 */
export type OAuthProvider = "google" | "discord" | "facebook";

/**
 * Shape of an individual OAuth account link.
 */
export interface OAuthAccount {
  provider: OAuthProvider;
  providerId: string;
  linkedAt: Date;
}

/**
 * Input shape when creating a User document.
 * Kept minimal — other fields have defaults or are set by hooks.
 */
export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
}