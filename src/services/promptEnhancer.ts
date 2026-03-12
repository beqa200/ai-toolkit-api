import { ExternalServiceError } from "../lib/errors";
import logger from "../lib/logger";

const POLLINATIONS_BASE_URL = process.env.POLLINATIONS_BASE_URL;

const SYSTEM_PROMPT = [
  "You are a prompt enhancement specialist.",
  "Given a short user prompt, expand it into a detailed, vivid, high-quality generation prompt.",
  "Add artistic style, lighting, mood, and detail keywords.",
  "Return ONLY the enhanced prompt text, nothing else.",
  "Keep it under 200 characters.",
].join(" ");

export async function enhancePrompt(prompt: string): Promise<string> {
  if (!prompt.trim()) {
    throw new ExternalServiceError("PromptEnhancer", "Prompt cannot be empty");
  }

  const message = `Enhance this prompt for AI generation: "${prompt}"`;
  const encodedMessage = encodeURIComponent(message);

  const queryParams = new URLSearchParams({
    system: SYSTEM_PROMPT,
    json: "false",
  });

  const url = `${POLLINATIONS_BASE_URL}/text/${encodedMessage}?${queryParams}`;

  logger.info("Enhancing prompt via Pollinations", {
    context: "PromptEnhancer",
  });

  let response: Response;
  try {
    response = await fetch(url, {
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
      `Enhancement API returned ${response.status}: ${response.statusText}`
    );
  }

  const enhanced = await response.text();

  if (!enhanced.trim()) {
    throw new ExternalServiceError(
      "Pollinations",
      "Enhancement API returned an empty response"
    );
  }

  logger.info(`Prompt enhanced (${enhanced.trim().length} chars)`, {
    context: "PromptEnhancer",
  });

  return enhanced.trim();
}
