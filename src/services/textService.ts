const POLLINATIONS_BASE_URL = process.env.POLLINATIONS_BASE_URL;

interface TextParameters {
  tone?: string;
  maxLength?: number;
}

export async function generateText(prompt: string, parameters?: TextParameters): Promise<string> {
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty');
  }

  const parts = [prompt];
  if (parameters?.tone) {
    parts.push(`Use a ${parameters.tone} tone.`);
  }
  if (parameters?.maxLength) {
    parts.push(`Keep the response under ${parameters.maxLength} characters.`);
  }

  const fullPrompt = parts.join(' ');
  const encodedPrompt = encodeURIComponent(fullPrompt);
  const url = `${POLLINATIONS_BASE_URL}/text/${encodedPrompt}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
    });

    if (!response.ok) {
      throw new Error(`Pollinations API returned status ${response.status}`);
    }

    const text = await response.text();

    if (!text.trim()) {
      throw new Error('Pollinations API returned an empty response');
    }

    return text.trim();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Failed to reach Pollinations API: ${error.message}`);
    }
    throw error;
  }
}
