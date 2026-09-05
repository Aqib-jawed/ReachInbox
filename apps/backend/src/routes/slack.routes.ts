import { Router } from "express";
import {
  handleSlackOAuthStart,
  handleSlackOAuthCallback,
  handleGetSlackStatusBySender,
  handleDisconnectSlackBySender,
} from "../controllers/slack.controller";

const router = Router();

// OAuth 2.0 incoming-webhook flow
router.get("/oauth/start", handleSlackOAuthStart);
router.get("/oauth/callback", handleSlackOAuthCallback);

// Backward-compatible alias routes
router.get("/connect", handleSlackOAuthStart);
router.get("/callback", handleSlackOAuthCallback);

// Per-sender status & disconnect
router.get("/status/:senderId", handleGetSlackStatusBySender);
router.get("/status", handleGetSlackStatusBySender);

router.post("/disconnect/:senderId", handleDisconnectSlackBySender);
router.post("/disconnect", handleDisconnectSlackBySender);

export default router;
