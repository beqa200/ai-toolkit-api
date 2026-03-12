import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { ExternalServiceError } from "../lib/errors";
import { pollinationsRequest } from "../lib/pollinationsClient";
import logger from "../lib/logger";

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

  const response = await pollinationsRequest(
    `/image/${encodedPrompt}?${queryParams.toString()}`,
    "ImageService"
  );

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
