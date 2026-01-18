/**
 * TTS (Text-to-Speech) Type Definitions
 * Types for pocket-tts server integration
 */

/**
 * Options for generating speech from text
 */
export interface TTSOptions {
  /** The text content to convert to speech */
  text: string;
  /** Voice identifier (default: "alba") */
  voice?: string;
  /** TTS server URL (default: "http://localhost:8000") */
  serverUrl?: string;
}

/**
 * Status of the TTS playback
 */
export type TTSStatus = "idle" | "loading" | "playing" | "paused" | "error";

/**
 * State of TTS playback for UI components
 */
export interface TTSState {
  /** Current playback status */
  status: TTSStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Audio element if speech has been generated */
  audio?: HTMLAudioElement;
}

/**
 * Error thrown by TTS service operations
 */
export class TTSError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SERVER_UNAVAILABLE"
      | "SERVER_ERROR"
      | "NETWORK_ERROR"
      | "INVALID_RESPONSE",
  ) {
    super(message);
    this.name = "TTSError";
  }
}
