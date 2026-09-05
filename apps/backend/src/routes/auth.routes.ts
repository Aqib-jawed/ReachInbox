import { Router } from "express";
import {
  handleGoogleLogin,
  handleGoogleCallback,
  handleDevLogin,
  handleGetCurrentUser,
  handleLogout,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/google", handleGoogleLogin);
router.get("/google/callback", handleGoogleCallback);
router.post("/dev-login", handleDevLogin);
router.get("/me", requireAuth, handleGetCurrentUser);
router.post("/logout", handleLogout);

export default router;
