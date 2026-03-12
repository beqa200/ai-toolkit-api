import { ExternalServiceError } from "../lib/errors";
import { pollinationsRequest } from "../lib/pollinationsClient";
import logger from "../lib/logger";

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

  const response = await pollinationsRequest(
    `/text/${encodedPrompt}`,
    "TextService"
  );

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
