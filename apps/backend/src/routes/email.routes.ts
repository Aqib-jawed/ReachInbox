import { Router } from "express";
import {
  handleScheduleEmails,
  handleGetScheduledEmails,
  handleGetSentEmails,
  handleSearchEmails,
} from "../controllers/email.controller";

const router = Router();

router.post("/schedule", handleScheduleEmails);
router.get("/scheduled", handleGetScheduledEmails);
router.get("/sent", handleGetSentEmails);
router.get("/search", handleSearchEmails);

export default router;
