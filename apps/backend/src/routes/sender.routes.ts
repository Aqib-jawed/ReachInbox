import { Router } from "express";
import { handleCreateSender, handleGetSenders } from "../controllers/sender.controller";

const router = Router();

router.post("/", handleCreateSender);
router.get("/", handleGetSenders);

export default router;
