import { Router, Request, Response, NextFunction } from "express";
import { GenerationType, GenerationJob } from "@prisma/client";
import {
  createJob,
  getJobById,
  getAllJobs,
  updateJobStatus,
  saveJobResult,
  cancelJob,
  getJobForRetry,
} from "../repositories/generation.repository";
import { enhancePrompt } from "../services/promptEnhancer";
import { generateImage } from "../services/imageService";
import { generateText } from "../services/textService";
import { emitJobUpdate } from "../lib/socket";
import { ValidationError, NotFoundError } from "../lib/errors";
import logger from "../lib/logger";

const router = Router();

const VALID_TYPES = Object.values(GenerationType);

const activeJobs = new Map<string, AbortController>();

async function processJob(job: GenerationJob): Promise<void> {
  const log = (msg: string, level: "info" | "warn" | "error" = "info") =>
    logger[level](msg, { context: "JobProcessor", jobId: job.id });

  const abortController = new AbortController();
  activeJobs.set(job.id, abortController);

  try {
    log("Starting processing");
    const generating = await updateJobStatus(job.id, "GENERATING");
    emitJobUpdate(generating);

    if (abortController.signal.aborted) {
      log("Job was cancelled before processing started");
      return;
    }

    let enhancedPromptText: string | undefined;
    try {
      enhancedPromptText = await enhancePrompt(job.originalPrompt);
      log(`Prompt enhanced: "${enhancedPromptText}"`);
    } catch (err) {
      log(
        `Prompt enhancement failed: ${err instanceof Error ? err.message : err}`,
        "warn"
      );
    }

    if (abortController.signal.aborted) {
      log("Job was cancelled after prompt enhancement");
      return;
    }

    const prompt = enhancedPromptText || job.originalPrompt;

    let updated: GenerationJob;
    if (job.type === GenerationType.IMAGE) {
      log("Generating image");
      const resultUrl = await generateImage(prompt);
      
      if (abortController.signal.aborted) {
        log("Job was cancelled after image generation");
        return;
      }
      
      updated = await saveJobResult(job.id, {
        enhancedPrompt: enhancedPromptText,
        resultUrl,
      });
    } else {
      log("Generating text");
      const resultText = await generateText(prompt);
      
      if (abortController.signal.aborted) {
        log("Job was cancelled after text generation");
        return;
      }
      
      updated = await saveJobResult(job.id, {
        enhancedPrompt: enhancedPromptText,
        resultText,
      });
    }

    log("Completed successfully");
    emitJobUpdate(updated);
  } catch (error) {
    if (abortController.signal.aborted) {
      log("Job processing was aborted");
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(`Failed: ${message}`, "error");

    try {
      const failed = await updateJobStatus(job.id, "FAILED", message);
      emitJobUpdate(failed);
    } catch (dbError) {
      log(
        `Failed to update job status to FAILED: ${dbError instanceof Error ? dbError.message : dbError}`,
        "error"
      );
    }
  } finally {
    activeJobs.delete(job.id);
  }
}

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, type, priority } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      throw new ValidationError("A non-empty prompt is required");
    }

    if (!type || !VALID_TYPES.includes(type)) {
      throw new ValidationError(
        `Type must be one of: ${VALID_TYPES.join(", ")}`
      );
    }

    if (
      priority !== undefined &&
      (typeof priority !== "number" || priority < 0)
    ) {
      throw new ValidationError("Priority must be a non-negative number");
    }

    const job = await createJob({
      originalPrompt: prompt.trim(),
      type,
      priority,
    });

    logger.info(`Job created: ${job.id}`, { context: "API", jobId: job.id });

    processJob(job).catch((err) =>
      logger.error(`Background processing failed for job ${job.id}`, {
        context: "JobProcessor",
        jobId: job.id,
        stack: err instanceof Error ? err.stack : undefined,
      })
    );

    res.status(201).json({
      jobId: job.id,
      status: job.status,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = _req.query.limit
      ? parseInt(_req.query.limit as string, 10)
      : undefined;
    const offset = _req.query.offset
      ? parseInt(_req.query.offset as string, 10)
      : undefined;

    const jobs = await getAllJobs({ limit, offset });

    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await getJobById(req.params.id as string);

    if (!job) {
      throw new NotFoundError("Job");
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.id as string;
    const existingJob = await getJobById(jobId);

    if (!existingJob) {
      throw new NotFoundError("Job");
    }

    if (existingJob.status === "COMPLETED" || existingJob.status === "FAILED" || existingJob.status === "CANCELLED") {
      throw new ValidationError(`Cannot cancel a job with status: ${existingJob.status}`);
    }

    const abortController = activeJobs.get(jobId);
    if (abortController) {
      abortController.abort();
    }

    const cancelledJob = await cancelJob(jobId);
    
    logger.info(`Job cancelled: ${jobId}`, { context: "API", jobId });
    emitJobUpdate(cancelledJob);

    res.json({
      jobId: cancelledJob.id,
      status: cancelledJob.status,
      message: "Job cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/retry", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.id as string;
    const existingJob = await getJobForRetry(jobId);

    if (!existingJob) {
      throw new NotFoundError("Job");
    }

    const newJob = await createJob({
      originalPrompt: existingJob.originalPrompt,
      type: existingJob.type,
      priority: existingJob.priority,
    });

    logger.info(`Job retried: ${jobId} -> ${newJob.id}`, { 
      context: "API", 
      originalJobId: jobId,
      newJobId: newJob.id 
    });

    processJob(newJob).catch((err) =>
      logger.error(`Background processing failed for job ${newJob.id}`, {
        context: "JobProcessor",
        jobId: newJob.id,
        stack: err instanceof Error ? err.stack : undefined,
      })
    );

    res.status(201).json({
      jobId: newJob.id,
      status: newJob.status,
      originalJobId: jobId,
      message: "Job retry initiated",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
