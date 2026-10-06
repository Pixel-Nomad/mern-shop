import { Router } from "express";
import { signup, verifyEmail } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/signup", signup);
authRouter.post("/verify-email", verifyEmail);