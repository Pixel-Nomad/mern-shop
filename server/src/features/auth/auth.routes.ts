import { Router } from "express";
import {
  signup,
  verifyEmail,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
} from "./auth.controller.js";
import { protect } from "../../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/signup", signup);
authRouter.post("/verify-email", verifyEmail);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", protect, me);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);