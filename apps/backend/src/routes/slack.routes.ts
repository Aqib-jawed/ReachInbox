import { Router } from "express";
import {
  handleSlackConnect,
  handleSlackCallback,
  handleGetSlackStatus,
  handleDisconnectSlack,
} from "../controllers/slack.controller";

const router = Router();

router.get("/connect", handleSlackConnect);
router.get("/callback", handleSlackCallback);
router.get("/status", handleGetSlackStatus);
router.post("/disconnect", handleDisconnectSlack);

export default router;
