const POLLINATIONS_BASE_URL = process.env.POLLINATIONS_BASE_URL;

interface ImageParameters {
  style?: string;
  resolution?: number;
}

export async function generateImage(prompt: string, parameters?: ImageParameters): Promise<string> {
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty');
  }

  const fullPrompt = parameters?.style ? `${prompt}, ${parameters.style} style` : prompt;

  const encodedPrompt = encodeURIComponent(fullPrompt);

  const queryParams = new URLSearchParams();
  if (parameters?.resolution) {
    queryParams.set('width', String(parameters.resolution));
    queryParams.set('height', String(parameters.resolution));
  }

  const queryString = queryParams.toString();
  const url = `${POLLINATIONS_BASE_URL}/image/${encodedPrompt}${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
      method: 'HEAD',
    });

    if (!response.ok) {
      throw new Error(`Pollinations API returned status ${response.status}`);
    }

    return url;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Failed to reach Pollinations API: ${error.message}`);
    }
    throw error;
  }
}
