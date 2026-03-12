import { Router, Request, Response } from "express";
import { GenerationType, GenerationJob } from "@prisma/client";
import {
  createJob,
  getJobById,
  getAllJobs,
  updateJobStatus,
  saveJobResult,
} from "../repositories/generation.repository";
import { enhancePrompt } from "../services/promptEnhancer";
import { generateImage } from "../services/imageService";
import { generateText } from "../services/textService";
import { emitJobUpdate } from "../lib/socket";

const router = Router();

const VALID_TYPES = Object.values(GenerationType);

async function processJob(job: GenerationJob): Promise<void> {
  try {
    const generating = await updateJobStatus(job.id, "GENERATING");
    emitJobUpdate(generating);

    const prompt = job.enhancedPrompt || job.originalPrompt;

    let updated: GenerationJob;
    if (job.type === GenerationType.IMAGE) {
      const resultUrl = await generateImage(prompt);
      updated = await saveJobResult(job.id, { resultUrl });
    } else {
      const resultText = await generateText(prompt);
      updated = await saveJobResult(job.id, { resultText });
    }
    emitJobUpdate(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    const failed = await updateJobStatus(job.id, "FAILED", message);
    emitJobUpdate(failed);
  }
}

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

    // Fire-and-forget: generation runs in the background
    processJob(job).catch((err) =>
      console.error(`Background processing failed for job ${job.id}:`, err)
    );

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

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const jobs = await getAllJobs({ limit, offset });

    res.json(jobs);
  } catch (error) {
    console.error("Failed to fetch jobs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const job = await getJobById(req.params.id as string);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json(job);
  } catch (error) {
    console.error("Failed to fetch job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
