/**
 * Streaming TTS Functions
 *
 * Provides low-latency streaming TTS playback using Web Audio API
 * with seamless handoff to native audio controls for replay.
 */

import { HybridStreamingPlayer } from "./streaming-player.js";

/** Result of streaming TTS playback */
export interface StreamingTTSResult {
  /** Complete audio as a Blob */
  blob: Blob;
  /** Object URL for the blob (for use with audio elements) */
  blobUrl: string;
  /** Playback position when streaming completed (for seamless handoff) */
  currentTime: number;
}

/** Global player reference for stop functionality */
let currentPlayer: HybridStreamingPlayer | null = null;

/**
 * Start streaming TTS playback (hybrid approach)
 *
 * - Plays immediately via Web Audio API (low latency)
 * - Returns blob URL and current position for seamless handoff to native <audio> controls
 *
 * @param text - The text to convert to speech
 * @param serverUrl - The TTS server URL (e.g., "http://localhost:8000")
 * @param voice - Voice identifier (default: "alba")
 * @param onFirstAudio - Callback when first audio chunk starts playing
 * @param onComplete - Callback when streaming finishes with result for handoff
 * @param onError - Callback on error
 */
export async function startStreamingTTS(
  text: string,
  serverUrl: string,
  voice: string = "alba",
  onFirstAudio?: () => void,
  onComplete?: (result: StreamingTTSResult) => void,
  onError?: (error: Error) => void,
): Promise<void> {
  // Stop any existing playback
  if (currentPlayer) {
    currentPlayer.stop();
    currentPlayer = null;
  }

  const formData = new FormData();
  formData.append("text", text);
  formData.append("voice_url", voice);

  console.log("[TTS] Starting streaming fetch to", serverUrl);

  try {
    const response = await fetch(`${serverUrl}/tts`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`TTS server error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body for streaming");
    }

    const reader = response.body.getReader();
    currentPlayer = new HybridStreamingPlayer(onFirstAudio);

    // Process stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        currentPlayer.addChunk(value);
      }
    }

    // Create blob for replay and get current position for seamless handoff
    const blob = currentPlayer.getBlob();
    const blobUrl = URL.createObjectURL(blob);
    const currentTime = currentPlayer.stopAndGetPosition();
    console.log(
      "[TTS] Stream complete, blob size:",
      blob.size,
      "handoff at:",
      currentTime.toFixed(2) + "s",
    );

    onComplete?.({ blob, blobUrl, currentTime });
  } catch (error) {
    console.error("[TTS] Streaming error:", error);
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

/** Stop any currently streaming TTS playback */
export function stopStreamingTTS(): void {
  if (currentPlayer) {
    currentPlayer.stop();
    currentPlayer = null;
  }
}

/** Pause the current streaming TTS playback */
export function pauseStreamingTTS(): void {
  if (currentPlayer) {
    currentPlayer.pause();
  }
}

/** Resume paused streaming TTS playback */
export function resumeStreamingTTS(): void {
  if (currentPlayer) {
    currentPlayer.resume();
  }
}
