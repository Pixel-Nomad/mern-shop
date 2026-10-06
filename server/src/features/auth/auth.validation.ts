import { z } from "zod";

/**
 * Password rules. Enforced on the server (client validation is for UX only).
 * - At least 8 chars
 * - At least one lowercase, one uppercase, one digit
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a digit");

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email"),
  password: passwordSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;