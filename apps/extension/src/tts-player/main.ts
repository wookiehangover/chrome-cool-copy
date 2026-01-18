/**
 * TTS Player - Extension page for streaming text-to-speech playback
 *
 * This page is opened as a popup window when triggering TTS from context menu.
 * It reads pending text from chrome.storage.local and starts streaming immediately.
 */

import {
  startStreamingTTS,
  stopStreamingTTS,
  pauseStreamingTTS,
  resumeStreamingTTS,
  checkTTSServerAvailable,
  type StreamingTTSResult,
} from "@repo/shared/tts";

// DOM elements
const pageTitleEl = document.getElementById("page-title") as HTMLHeadingElement;
const errorDialog = document.getElementById("error-dialog") as HTMLDivElement;
const errorCloseBtn = document.getElementById("error-close-btn") as HTMLButtonElement;
const statusContainer = document.getElementById("status-container") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLSpanElement;
const audioContainer = document.getElementById("audio-container") as HTMLDivElement;
const audioPlayer = document.getElementById("audio-player") as HTMLAudioElement;
const playPauseBtn = document.getElementById("play-pause-btn") as HTMLButtonElement;
const playIcon = document.getElementById("play-icon") as unknown as SVGElement;
const pauseIcon = document.getElementById("pause-icon") as unknown as SVGElement;
const stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;

// State
let isStreaming = false;
let isPaused = false;
let audioBlob: Blob | null = null;
let audioBlobUrl: string | null = null;
let pageTitle = "TTS Player";

// Default TTS URL
const DEFAULT_TTS_URL = "http://localhost:8000";

/**
 * Show the error dialog
 */
function showError(): void {
  errorDialog.classList.remove("hidden");
  statusContainer.classList.add("hidden");
}

/**
 * Hide the error dialog
 */
function hideError(): void {
  errorDialog.classList.add("hidden");
}

/**
 * Update the status text
 */
function setStatus(text: string): void {
  statusText.textContent = text;
  statusContainer.classList.remove("hidden");
}

/**
 * Update play/pause button state
 */
function updatePlayPauseButton(): void {
  if (isPaused) {
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
    playPauseBtn.title = "Resume";
  } else {
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
    playPauseBtn.title = "Pause";
  }
}

/**
 * Handle play/pause button click
 */
function handlePlayPause(): void {
  if (isStreaming) {
    // During streaming: pause/resume the streaming player
    if (isPaused) {
      resumeStreamingTTS();
      isPaused = false;
      setStatus("Streaming...");
    } else {
      pauseStreamingTTS();
      isPaused = true;
      setStatus("Paused");
    }
    updatePlayPauseButton();
  } else if (audioPlayer.src) {
    // After streaming: control the audio element
    if (audioPlayer.paused) {
      audioPlayer.play();
      isPaused = false;
    } else {
      audioPlayer.pause();
      isPaused = true;
    }
    updatePlayPauseButton();
  }
}

/**
 * Handle stop button click
 */
function handleStop(): void {
  stopStreamingTTS();
  isStreaming = false;
  isPaused = false;

  // Clean up blob URL
  if (audioBlobUrl) {
    URL.revokeObjectURL(audioBlobUrl);
    audioBlobUrl = null;
  }

  // Close the window
  window.close();
}

/**
 * Handle save button click - download the audio as MP3
 */
function handleSave(): void {
  if (!audioBlob) return;

  // Create download link
  const url = URL.createObjectURL(audioBlob);
  const a = document.createElement("a");
  a.href = url;
  // Use the page title for the filename, sanitized
  const filename = pageTitle.replace(/[^a-z0-9]/gi, "_").substring(0, 50) || "audio";
  a.download = `${filename}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Start TTS streaming
 */
async function startTTS(text: string, ttsUrl: string): Promise<void> {
  setStatus("Checking server...");

  // Check if TTS server is available
  const isAvailable = await checkTTSServerAvailable(ttsUrl);
  if (!isAvailable) {
    showError();
    return;
  }

  setStatus("Streaming...");
  playPauseBtn.disabled = false;
  isStreaming = true;
  updatePlayPauseButton();

  startStreamingTTS(
    text,
    ttsUrl,
    "alba",
    // onFirstAudio - first audio chunk playing
    () => {
      console.log("[TTS Player] First audio chunk playing");
      setStatus("Streaming...");
    },
    // onComplete - streaming finished
    (result: StreamingTTSResult) => {
      console.log("[TTS Player] Streaming complete");
      isStreaming = false;
      audioBlob = result.blob;
      audioBlobUrl = result.blobUrl;

      // Show the audio player
      audioContainer.classList.remove("hidden");
      statusContainer.classList.add("hidden");
      audioPlayer.src = result.blobUrl;

      // Seek to the handoff position and play
      audioPlayer.currentTime = result.currentTime;
      audioPlayer.play().catch((err) => {
        console.error("[TTS Player] Failed to auto-play:", err);
      });

      // Enable save button
      saveBtn.disabled = false;
      isPaused = false;
      updatePlayPauseButton();
    },
    // onError
    (error: Error) => {
      console.error("[TTS Player] Error:", error);
      isStreaming = false;
      setStatus(`Error: ${error.message}`);
      playPauseBtn.disabled = true;
    },
  );
}

/**
 * Initialize the TTS player
 */
async function init(): Promise<void> {
  // Set up event listeners
  errorCloseBtn.addEventListener("click", () => {
    hideError();
    window.close();
  });
  playPauseBtn.addEventListener("click", handlePlayPause);
  stopBtn.addEventListener("click", handleStop);
  saveBtn.addEventListener("click", handleSave);

  // Audio player events
  audioPlayer.addEventListener("play", () => {
    isPaused = false;
    updatePlayPauseButton();
  });
  audioPlayer.addEventListener("pause", () => {
    isPaused = true;
    updatePlayPauseButton();
  });
  audioPlayer.addEventListener("ended", () => {
    isPaused = true;
    updatePlayPauseButton();
  });

  // Read pending text from storage
  setStatus("Loading...");

  try {
    const result = await chrome.storage.local.get(["tts_pending_text", "tts_url"]);

    // tts_pending_text is an object: { text, title, url, timestamp }
    const pendingData = result.tts_pending_text as
      | { text: string; title: string; url: string; timestamp: number }
      | undefined;
    const text = pendingData?.text;
    pageTitle = pendingData?.title || "TTS Player";
    const ttsUrl = (result.tts_url as string) || DEFAULT_TTS_URL;

    // Update page title
    pageTitleEl.textContent = pageTitle;
    document.title = `${pageTitle} - TTS Player`;

    // Clear the pending text from storage
    await chrome.storage.local.remove(["tts_pending_text"]);

    if (!text || text.trim().length === 0) {
      setStatus("No text to read");
      return;
    }

    // Start TTS
    await startTTS(text.trim(), ttsUrl);
  } catch (error) {
    console.error("[TTS Player] Init error:", error);
    setStatus("Failed to load text");
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
