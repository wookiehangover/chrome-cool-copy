/**
 * TTS Audio Player Component for Clips Viewer
 * Simple floating player with native browser audio controls
 * Uses direct fetch to localhost TTS server (no offscreen document needed for extension pages)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2 } from "lucide-react";

const TTS_SERVER_URL = "http://localhost:8000";

/**
 * Fetch TTS audio directly from local server
 * Extension pages can fetch from localhost without CORS issues
 */
async function fetchTTSAudio(text: string, voice: string = "alba"): Promise<string> {
  const formData = new FormData();
  formData.append("text", text);
  formData.append("voice_url", voice);

  const response = await fetch(`${TTS_SERVER_URL}/tts`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`TTS server error: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

interface TTSPlayerProps {
  /** Text to speak (triggers playback when changed) */
  text: string | null;
  /** Callback when player is closed */
  onClose?: () => void;
}

type PlayerStatus = "hidden" | "loading" | "ready" | "error";

export function TTSPlayer({ text, onClose }: TTSPlayerProps) {
  const [status, setStatus] = useState<PlayerStatus>("hidden");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Clean up object URL on unmount or when audio changes
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Fetch TTS audio when text changes
  useEffect(() => {
    if (!text) {
      setStatus("hidden");
      return;
    }

    const fetchAudio = async () => {
      // Clean up previous audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      setStatus("loading");
      setError(null);

      try {
        const url = await fetchTTSAudio(text);
        setAudioUrl(url);
        setStatus("ready");
      } catch (err) {
        console.error("[TTSPlayer] Failed to fetch TTS:", err);
        setError(err instanceof Error ? err.message : "Failed to generate speech");
        setStatus("error");
      }
    };

    fetchAudio();
  }, [text]);

  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setStatus("hidden");
    onClose?.();
  }, [audioUrl, onClose]);

  const handleEnded = useCallback(() => {
    // Auto-close after playback ends
    handleClose();
  }, [handleClose]);

  if (status === "hidden") return null;

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-lg shadow-lg z-[200]">
      {status === "loading" && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading audio...</span>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-destructive">
          <span className="text-sm">{error || "Error"}</span>
        </div>
      )}

      {status === "ready" && audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          autoPlay
          onEnded={handleEnded}
          className="h-8"
        />
      )}

      <button
        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        onClick={handleClose}
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
