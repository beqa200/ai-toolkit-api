import http from "http";
import path from "path";
import express from "express";
import cors from "cors";
import generationRoutes from "./routes/generation.routes";
import { initSocket } from "./lib/socket";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { globalLimiter, generationLimiter, strictLimiter } from "./middleware/rateLimiter";
import logger from "./lib/logger";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

initSocket(server);

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(globalLimiter);
app.use("/images", express.static(path.join(__dirname, "../public/images")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/generations", generationLimiter, strictLimiter);
app.use("/api/generations", generationRoutes);

app.use(errorHandler);

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { context: "Process", stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", {
    context: "Process",
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`, { context: "Server" });
});

export default app;
