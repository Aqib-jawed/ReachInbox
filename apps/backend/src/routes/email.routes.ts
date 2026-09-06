import { Router } from "express";
import {
  handleScheduleEmails,
  handleGetScheduledEmails,
  handleGetSentEmails,
  handleSearchEmails,
  handleCancelEmail,
  handleRetryEmail,
} from "../controllers/email.controller";

const router = Router();

router.post("/schedule", handleScheduleEmails);
router.get("/scheduled", handleGetScheduledEmails);
router.get("/sent", handleGetSentEmails);
router.get("/search", handleSearchEmails);
router.delete("/:id/cancel", handleCancelEmail);
router.post("/:id/retry", handleRetryEmail);

export default router;
