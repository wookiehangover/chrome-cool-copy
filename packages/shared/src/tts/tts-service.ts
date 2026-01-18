/**
 * TTS Service
 * Client for pocket-tts server API
 */

import { TTSOptions, TTSError } from "./tts-types.js";

/** Default TTS server URL */
const DEFAULT_SERVER_URL = "http://localhost:8000";

/** Default voice */
const DEFAULT_VOICE = "alba";

/**
 * Generate speech audio from text using the pocket-tts server
 *
 * @param options - TTS generation options
 * @returns Promise resolving to audio Blob (WAV format)
 * @throws TTSError if the server is unavailable or returns an error
 *
 * @example
 * ```ts
 * const audioBlob = await generateSpeech({ text: "Hello, world!" });
 * const audio = createAudioFromBlob(audioBlob);
 * audio.play();
 * ```
 */
export async function generateSpeech(options: TTSOptions): Promise<Blob> {
  const { text, voice = DEFAULT_VOICE, serverUrl = DEFAULT_SERVER_URL } = options;

  if (!text || text.trim().length === 0) {
    throw new TTSError("Text cannot be empty", "INVALID_RESPONSE");
  }

  const formData = new FormData();
  formData.append("text", text);
  formData.append("voice_url", voice);

  let response: Response;

  try {
    response = await fetch(`${serverUrl}/tts`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    // Network error - server likely unavailable
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new TTSError(
        `TTS server unavailable at ${serverUrl}. Make sure pocket-tts is running.`,
        "SERVER_UNAVAILABLE",
      );
    }
    throw new TTSError(
      `Network error connecting to TTS server: ${error instanceof Error ? error.message : "Unknown error"}`,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    throw new TTSError(
      `TTS server error: ${response.status} ${response.statusText}`,
      "SERVER_ERROR",
    );
  }

  const blob = await response.blob();

  // Validate we got audio data
  if (blob.size === 0) {
    throw new TTSError("TTS server returned empty response", "INVALID_RESPONSE");
  }

  return blob;
}

/**
 * Create an HTMLAudioElement from an audio Blob
 *
 * @param blob - Audio blob (e.g., from generateSpeech)
 * @returns HTMLAudioElement ready to play
 *
 * @example
 * ```ts
 * const audioBlob = await generateSpeech({ text: "Hello!" });
 * const audio = createAudioFromBlob(audioBlob);
 * audio.play();
 *
 * // Clean up when done
 * audio.addEventListener('ended', () => {
 *   revokeAudioUrl(audio);
 * });
 * ```
 */
export function createAudioFromBlob(blob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return audio;
}

/**
 * Clean up the object URL created for an audio element
 * Call this when the audio is no longer needed to free memory
 *
 * @param audio - HTMLAudioElement created by createAudioFromBlob
 */
export function revokeAudioUrl(audio: HTMLAudioElement): void {
  if (audio.src.startsWith("blob:")) {
    URL.revokeObjectURL(audio.src);
  }
}
