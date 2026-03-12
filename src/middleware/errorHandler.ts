import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";
import logger from "../lib/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error("Non-operational error", {
        context: "ErrorHandler",
        stack: err.stack,
      });
    } else {
      logger.warn(err.message, { context: "ErrorHandler" });
    }

    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  logger.error("Unhandled error", {
    context: "ErrorHandler",
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: "Internal server error",
  });
}
