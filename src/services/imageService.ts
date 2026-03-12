import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const POLLINATIONS_BASE_URL = process.env.POLLINATIONS_BASE_URL;
const IMAGES_DIR = path.join(__dirname, '../../public/images');

fs.mkdirSync(IMAGES_DIR, { recursive: true });

export async function generateImage(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);

  const queryParams = new URLSearchParams({
    width: '1024',
    height: '1024',
    model: 'flux',
    seed: Math.floor(Math.random() * 1_000_000).toString(),
  });

  const url = `${POLLINATIONS_BASE_URL}/image/${encodedPrompt}?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Pollinations image API returned ${response.status}: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `${randomUUID()}.jpg`;
  const filepath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filepath, buffer);

  return `/images/${filename}`;
}
