import prisma from '../lib/db';
import { GenerationType, JobStatus } from '@prisma/client';

export function createJob(data: {
  originalPrompt: string;
  enhancedPrompt?: string;
  type: GenerationType;
  priority?: number;
}) {
  return prisma.generationJob.create({
    data: {
      originalPrompt: data.originalPrompt,
      enhancedPrompt: data.enhancedPrompt,
      type: data.type,
      priority: data.priority ?? 0,
    },
  });
}

export function cancelJob(id: string) {
  return prisma.generationJob.update({
    where: { id },
    data: {
      status: JobStatus.CANCELLED,
      cancelled: true,
    },
  });
}

export function getJobForRetry(id: string) {
  return prisma.generationJob.findUnique({
    where: { id },
    select: {
      originalPrompt: true,
      type: true,
      priority: true,
    },
  });
}

export function getJobById(id: string) {
  return prisma.generationJob.findUnique({
    where: { id },
    select: {
      id: true,
      originalPrompt: true,
      type: true,
      status: true,
      resultUrl: true,
      resultText: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function getAllJobs(options?: { limit?: number; offset?: number }) {
  return prisma.generationJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: options?.limit,
    skip: options?.offset,
    select: {
      id: true,
      originalPrompt: true,
      type: true,
      status: true,
      resultUrl: true,
      resultText: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function getPendingJobs(limit: number = 5) {
  return prisma.generationJob.findMany({
    where: {
      status: JobStatus.PENDING,
      cancelled: false,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  });
}

export function updateJobStatus(id: string, status: JobStatus, errorMessage?: string) {
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
  },
) {
  return prisma.generationJob.update({
    where: { id },
    data: {
      status: JobStatus.COMPLETED,
      ...result,
    },
  });
}
