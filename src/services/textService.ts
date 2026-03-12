import { ExternalServiceError } from "../lib/errors";
import logger from "../lib/logger";

const POLLINATIONS_BASE_URL = process.env.POLLINATIONS_BASE_URL;

interface TextParameters {
  tone?: string;
  maxLength?: number;
}

export async function generateText(
  prompt: string,
  parameters?: TextParameters
): Promise<string> {
  if (!prompt.trim()) {
    throw new ExternalServiceError("TextService", "Prompt cannot be empty");
  }

  const parts = [prompt];
  if (parameters?.tone) {
    parts.push(`Use a ${parameters.tone} tone.`);
  }
  if (parameters?.maxLength) {
    parts.push(`Keep the response under ${parameters.maxLength} characters.`);
  }

  const fullPrompt = parts.join(" ");
  const encodedPrompt = encodeURIComponent(fullPrompt);
  const url = `${POLLINATIONS_BASE_URL}/text/${encodedPrompt}`;

  logger.info("Requesting text from Pollinations", { context: "TextService" });

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
      `Text API returned ${response.status}: ${response.statusText}`
    );
  }

  const text = await response.text();

  if (!text.trim()) {
    throw new ExternalServiceError(
      "Pollinations",
      "Text API returned an empty response"
    );
  }

  logger.info(`Text generated (${text.trim().length} chars)`, {
    context: "TextService",
  });

  return text.trim();
}
