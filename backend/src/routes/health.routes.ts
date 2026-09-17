import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "SkillForge API is healthy",
    timestamp: new Date().toISOString()
  });
});

export default router;