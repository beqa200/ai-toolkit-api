import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { ExternalServiceError } from "../lib/errors";
import logger from "../lib/logger";

const POLLINATIONS_BASE_URL = process.env.POLLINATIONS_BASE_URL;
const IMAGES_DIR = path.join(__dirname, "../../public/images");

fs.mkdirSync(IMAGES_DIR, { recursive: true });

export async function generateImage(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);

  const queryParams = new URLSearchParams({
    width: "1024",
    height: "1024",
    model: "flux",
    seed: Math.floor(Math.random() * 1_000_000).toString(),
  });

  const url = `${POLLINATIONS_BASE_URL}/image/${encodedPrompt}?${queryParams.toString()}`;

  logger.info("Requesting image from Pollinations", { context: "ImageService" });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`,
      },
    });
  } catch (error) {
    throw new ExternalServiceError(
      "Pollinations",
      `Network error: ${error instanceof Error ? error.message : "connection failed"}`
    );
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      "Pollinations",
      `Image API returned ${response.status}: ${response.statusText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new ExternalServiceError("Pollinations", "Returned empty image data");
  }

  const filename = `${randomUUID()}.jpg`;
  const filepath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filepath, buffer);

  logger.info(`Image saved: ${filename} (${buffer.length} bytes)`, {
    context: "ImageService",
  });

  return `/images/${filename}`;
}
