import { Router } from "express";
import {
  handleCreateSender,
  handleGetSenders,
  handleStartWarmup,
  handleStopWarmup,
  handleGetWarmupStatus,
} from "../controllers/sender.controller";

const router = Router();

router.post("/", handleCreateSender);
router.get("/", handleGetSenders);
router.post("/:id/warmup/start", handleStartWarmup);
router.post("/:id/warmup/stop", handleStopWarmup);
router.get("/:id/warmup/status", handleGetWarmupStatus);

export default router;
