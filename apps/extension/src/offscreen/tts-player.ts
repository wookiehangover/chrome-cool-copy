/**
 * Offscreen document for TTS audio playback
 *
 * This runs in an offscreen document context which CAN:
 * - Fetch from localhost (no CORS restrictions like content scripts)
 * - Play audio with <audio> element
 * - Stream audio immediately without waiting for full download
 *
 * The background service worker coordinates between content scripts and this player.
 */

const audio = document.getElementById("audio") as HTMLAudioElement;
let currentObjectUrl: string | null = null;

// Handle messages from the background service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen-tts") return;

  switch (message.action) {
    case "play":
      playTTS(message.text, message.voice, message.serverUrl)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // async response

    case "stop":
      stopTTS();
      sendResponse({ success: true });
      return false;

    case "pause":
      audio.pause();
      sendResponse({ success: true });
      return false;

    case "resume":
      audio.play();
      sendResponse({ success: true });
      return false;

    case "getState":
      sendResponse({
        success: true,
        state: {
          playing: !audio.paused && !audio.ended,
          paused: audio.paused,
          currentTime: audio.currentTime,
          duration: audio.duration,
        },
      });
      return false;
  }
});

async function playTTS(
  text: string,
  voice: string = "alba",
  serverUrl: string = "http://localhost:8000",
): Promise<void> {
  // Stop any existing playback
  stopTTS();

  console.log("[TTS Offscreen] Starting playback for text:", text.substring(0, 50) + "...");

  // Create form data for the request
  const formData = new FormData();
  formData.append("text", text);
  formData.append("voice_url", voice);

  // Fetch the audio - the browser will buffer and start playing before download completes
  // pocket-tts streams WAV data which the browser can play progressively
  const response = await fetch(`${serverUrl}/tts`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`TTS server error: ${response.status} ${response.statusText}`);
  }

  // Convert response to blob and play
  // Even though we wait for the blob, the browser's audio element will start
  // playing as soon as it has enough buffered data
  const blob = await response.blob();
  console.log("[TTS Offscreen] Got audio blob, size:", blob.size);

  currentObjectUrl = URL.createObjectURL(blob);
  audio.src = currentObjectUrl;

  // Set up event handlers before playing
  audio.onended = () => {
    console.log("[TTS Offscreen] Playback ended");
    chrome.runtime.sendMessage({ action: "ttsPlaybackEnded" });
    cleanup();
  };

  audio.onerror = (e) => {
    console.error("[TTS Offscreen] Playback error:", e);
    chrome.runtime.sendMessage({
      action: "ttsPlaybackError",
      error: "Audio playback failed",
    });
    cleanup();
  };

  await audio.play();
  console.log("[TTS Offscreen] Playback started");
}

function stopTTS(): void {
  audio.pause();
  audio.currentTime = 0;
  cleanup();
}

function cleanup(): void {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  audio.src = "";
}

// Report ready state
console.log("[TTS Offscreen] Ready");
