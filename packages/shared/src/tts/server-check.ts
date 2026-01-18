/**
 * TTS Server Availability Check
 *
 * Quick health check for pocket-tts server
 */

/**
 * Check if the TTS server is available
 *
 * Uses a GET request with a short timeout to quickly determine availability.
 * Note: pocket-tts doesn't support HEAD requests, so GET is used instead.
 *
 * @param serverUrl - The TTS server URL (e.g., "http://localhost:8000")
 * @param timeoutMs - Timeout in milliseconds (default: 3000)
 * @returns Promise resolving to true if server is available, false otherwise
 */
export async function checkTTSServerAvailable(
  serverUrl: string,
  timeoutMs: number = 3000,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Use GET instead of HEAD - pocket-tts doesn't support HEAD requests
    const response = await fetch(serverUrl, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

