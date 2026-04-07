// src/routes/auth.routes.js
import { Router } from "express";
import { register, login, logout, refreshAccessToken, getMe } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/errorHandler.js";

const router = Router();

router.post("/register", register);
router.post("/login",    login);
router.post("/logout",   logout);
router.post("/refresh",  refreshAccessToken);
router.get("/me",        authenticate, getMe);

export default router;