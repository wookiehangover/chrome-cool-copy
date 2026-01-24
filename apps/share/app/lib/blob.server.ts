import { put, del } from '@vercel/blob';
import { nanoid } from 'nanoid';

export async function uploadImageToBlob(
  file: File | Blob,
  originalFilename?: string
): Promise<{ url: string; pathname: string }> {
  const ext = originalFilename?.split('.').pop() || 'png';
  const pathname = `media/${nanoid()}.${ext}`;

  const blob = await put(pathname, file, {
    access: 'public',
    addRandomSuffix: false,
  });

  return { url: blob.url, pathname };
}

export async function deleteImageFromBlob(url: string): Promise<void> {
  await del(url);
}

