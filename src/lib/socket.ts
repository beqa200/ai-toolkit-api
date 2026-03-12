import { Server as HttpServer } from "http";
import { Server, ServerOptions } from "socket.io";
import { GenerationJob } from "@prisma/client";

let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  } as Partial<ServerOptions>);

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("subscribe", (jobId: string) => {
      socket.join(`job:${jobId}`);
    });

    socket.on("unsubscribe", (jobId: string) => {
      socket.leave(`job:${jobId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitJobUpdate(job: GenerationJob): void {
  if (!io) return;

  const payload = {
    jobId: job.id,
    status: job.status,
    resultUrl: job.resultUrl,
    resultText: job.resultText,
    errorMessage: job.errorMessage,
    updatedAt: job.updatedAt,
  };

  io.to(`job:${job.id}`).emit("job:update", payload);
  io.emit("jobs:changed", payload);
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
