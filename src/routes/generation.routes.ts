import { Router, Request, Response } from "express";
import { GenerationType } from "@prisma/client";
import { createJob } from "../repositories/generation.repository";
import { enhancePrompt } from "../services/promptEnhancer";

const router = Router();

const VALID_TYPES = Object.values(GenerationType);

router.post("/", async (req: Request, res: Response) => {
  try {
    const { prompt, type, priority } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "A non-empty prompt is required" });
      return;
    }

    if (!type || !VALID_TYPES.includes(type)) {
      res
        .status(400)
        .json({ error: `Type must be one of: ${VALID_TYPES.join(", ")}` });
      return;
    }

    if (priority !== undefined && (typeof priority !== "number" || priority < 0)) {
      res.status(400).json({ error: "Priority must be a non-negative number" });
      return;
    }

    let enhancedPromptText: string | undefined;
    try {
      enhancedPromptText = await enhancePrompt(prompt.trim());
    } catch {
      // Enhancement is best-effort; proceed with original prompt if it fails
    }

    const job = await createJob({
      originalPrompt: prompt.trim(),
      enhancedPrompt: enhancedPromptText,
      type,
      priority,
    });

    res.status(201).json({
      jobId: job.id,
      status: job.status,
      enhancedPrompt: job.enhancedPrompt,
    });
  } catch (error) {
    console.error("Failed to create generation job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
