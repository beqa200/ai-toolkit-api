import rateLimit from "express-rate-limit";
import logger from "../lib/logger";

const logRateLimitHit = (ip: string, endpoint: string) => {
  logger.warn(`Rate limit exceeded`, {
    context: "RateLimiter",
    ip,
    endpoint,
  });
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: "Too many requests, please try again later",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req.ip || "unknown", req.path);
    res.status(options.statusCode).json(options.message);
  },
});

export const generationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 generation requests per minute
  message: {
    error: "Too many generation requests, please slow down",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req.ip || "unknown", "POST /api/generations");
    res.status(options.statusCode).json(options.message);
  },
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 generation requests per hour
  message: {
    error: "Hourly generation limit reached, please try again later",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req.ip || "unknown", "POST /api/generations (hourly)");
    res.status(options.statusCode).json(options.message);
  },
});
