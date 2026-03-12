const POLLINATIONS_BASE_URL = process.env.POLLINATIONS_BASE_URL;

const SYSTEM_PROMPT = [
  'You are a prompt enhancement specialist.',
  'Given a short user prompt, expand it into a detailed, vivid, high-quality generation prompt.',
  'Add artistic style, lighting, mood, and detail keywords.',
  'Return ONLY the enhanced prompt text, nothing else.',
  'Keep it under 200 characters.',
].join(' ');

export async function enhancePrompt(prompt: string): Promise<string> {
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty');
  }

  const message = `Enhance this prompt for AI generation: "${prompt}"`;
  const encodedMessage = encodeURIComponent(message);

  const queryParams = new URLSearchParams({
    system: SYSTEM_PROMPT,
    json: 'false',
  });

  const url = `${POLLINATIONS_BASE_URL}/text/${encodedMessage}?${queryParams}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
    });

    if (!response.ok) {
      throw new Error(`Pollinations API returned status ${response.status}`);
    }

    const enhanced = await response.text();

    if (!enhanced.trim()) {
      throw new Error('Pollinations API returned an empty response');
    }

    return enhanced.trim();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Failed to reach Pollinations API: ${error.message}`);
    }
    throw error;
  }
}
