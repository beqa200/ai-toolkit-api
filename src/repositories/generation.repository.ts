import prisma from "../lib/db";
import { GenerationType, JobStatus } from "@prisma/client";

export function createJob(data: {
  originalPrompt: string;
  type: GenerationType;
  priority?: number;
}) {
  return prisma.generationJob.create({
    data: {
      originalPrompt: data.originalPrompt,
      type: data.type,
      priority: data.priority ?? 0,
    },
  });
}

export function getJobById(id: string) {
  return prisma.generationJob.findUnique({
    where: { id },
  });
}

export function getAllJobs(options?: { limit?: number; offset?: number }) {
  return prisma.generationJob.findMany({
    orderBy: { createdAt: "desc" },
    take: options?.limit,
    skip: options?.offset,
  });
}

export function getPendingJobs(limit: number = 5) {
  return prisma.generationJob.findMany({
    where: {
      status: JobStatus.PENDING,
      cancelled: false,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  errorMessage?: string
) {
  return prisma.generationJob.update({
    where: { id },
    data: {
      status,
      ...(errorMessage !== undefined && { errorMessage }),
    },
  });
}

export function saveJobResult(
  id: string,
  result: {
    enhancedPrompt?: string;
    resultUrl?: string;
    resultText?: string;
  }
) {
  return prisma.generationJob.update({
    where: { id },
    data: {
      status: JobStatus.COMPLETED,
      ...result,
    },
  });
}
