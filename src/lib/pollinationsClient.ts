import { ExternalServiceError } from "./errors";
import logger from "./logger";

const BASE_URL = process.env.POLLINATIONS_BASE_URL;

export async function pollinationsRequest(
  endpoint: string,
  context: string,
  method: string = "GET"
): Promise<Response> {
  const url = `${BASE_URL}${endpoint}`;

  logger.info(`Requesting ${method} ${endpoint}`, { context });

  let response: Response;
  try {
    response = await fetch(url, {
      method,
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
      `API returned ${response.status}: ${response.statusText}`
    );
  }

  return response;
}
