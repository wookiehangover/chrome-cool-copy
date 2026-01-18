import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useClips } from "@/hooks/useClips";
import { useShareUrl } from "@/hooks/useShareUrl";
import { getCachedAudio, cacheAudio } from "@/hooks/useTTSCache";
import type { LocalClip } from "@repo/shared";
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  ScrollText,
  Settings,
  Share2,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TTS_SERVER_URL = "http://localhost:8000";

/**
 * Hybrid Streaming WAV Player using Web Audio API
 * - Streams audio for immediate playback (no waiting)
 * - Accumulates chunks to create a blob for replay with native controls
 * - Tracks playback position for seamless handoff to audio element
 */
class HybridStreamingPlayer {
  private audioContext: AudioContext;
  private sampleRate = 0;
  private numChannels = 0;
  private headerParsed = false;
  private headerBuffer = new Uint8Array(44);
  private headerBytesReceived = 0;
  private nextStartTime = 0;
  private minBufferSize = 16384;
  private pcmData = new Uint8Array(0);
  private onFirstAudio?: () => void;
  private firstAudioPlayed = false;

  // For accumulating the full WAV file
  private allChunks: Uint8Array[] = [];
  private stopped = false;

  // For tracking playback position
  private playbackStartContextTime = 0;
  private totalScheduledDuration = 0;

  constructor(onFirstAudio?: () => void) {
    this.audioContext = new AudioContext();
    this.onFirstAudio = onFirstAudio;
  }

  private parseWavHeader(header: Uint8Array): void {
    const view = new DataView(header.buffer);
    const riff = String.fromCharCode(...Array.from(header.slice(0, 4)));
    const wave = String.fromCharCode(...Array.from(header.slice(8, 12)));

    if (riff !== "RIFF" || wave !== "WAVE") {
      throw new Error("Invalid WAV file");
    }

    this.numChannels = view.getUint16(22, true);
    this.sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    console.log(
      `[TTS] WAV Format: ${this.sampleRate}Hz, ${this.numChannels} channels, ${bitsPerSample} bits`,
    );
    this.headerParsed = true;
  }

  private appendPcmData(newData: Uint8Array): void {
    const newBuffer = new Uint8Array(this.pcmData.length + newData.length);
    newBuffer.set(this.pcmData);
    newBuffer.set(newData, this.pcmData.length);
    this.pcmData = newBuffer;
  }

  private tryPlayBuffer(): void {
    if (this.stopped || !this.headerParsed || this.pcmData.length < this.minBufferSize) {
      return;
    }

    const bytesPerSample = this.numChannels * 2;
    const samplesToPlay = Math.floor(this.pcmData.length / bytesPerSample);
    const bytesToPlay = samplesToPlay * bytesPerSample;

    if (bytesToPlay === 0) return;

    const dataToPlay = this.pcmData.slice(0, bytesToPlay);
    this.pcmData = this.pcmData.slice(bytesToPlay);

    const audioBuffer = this.audioContext.createBuffer(
      this.numChannels,
      samplesToPlay,
      this.sampleRate,
    );
    const int16Data = new Int16Array(
      dataToPlay.buffer,
      dataToPlay.byteOffset,
      samplesToPlay * this.numChannels,
    );

    for (let channel = 0; channel < this.numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < samplesToPlay; i++) {
        channelData[i] = int16Data[i * this.numChannels + channel] / 32768;
      }
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    source.start(startTime);

    // Track first audio playback and record start time for position tracking
    if (!this.firstAudioPlayed && this.onFirstAudio) {
      this.firstAudioPlayed = true;
      this.playbackStartContextTime = startTime;
      this.onFirstAudio();
    }

    this.nextStartTime = startTime + audioBuffer.duration;
    this.totalScheduledDuration += audioBuffer.duration;

    // Continue playing if there's more data
    if (this.pcmData.length >= this.minBufferSize) {
      setTimeout(() => this.tryPlayBuffer(), 10);
    }
  }

  addChunk(chunk: Uint8Array): void {
    // Always accumulate for later blob creation
    this.allChunks.push(new Uint8Array(chunk));

    if (!this.headerParsed) {
      const headerBytesNeeded = 44 - this.headerBytesReceived;
      const bytesToCopy = Math.min(headerBytesNeeded, chunk.length);

      this.headerBuffer.set(chunk.slice(0, bytesToCopy), this.headerBytesReceived);
      this.headerBytesReceived += bytesToCopy;

      if (this.headerBytesReceived >= 44) {
        this.parseWavHeader(this.headerBuffer);
        if (chunk.length > bytesToCopy) {
          this.appendPcmData(chunk.slice(bytesToCopy));
        }
      }
    } else {
      this.appendPcmData(chunk);
    }

    this.tryPlayBuffer();
  }

  // Flush any remaining buffered audio
  flush(): void {
    if (this.pcmData.length > 0 && this.headerParsed && !this.stopped) {
      const originalMin = this.minBufferSize;
      this.minBufferSize = 0;
      this.tryPlayBuffer();
      this.minBufferSize = originalMin;
    }
  }

  // Get the accumulated WAV blob for replay
  getBlob(): Blob {
    const totalLength = this.allChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.allChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return new Blob([combined], { type: "audio/wav" });
  }

  // Get current playback position in seconds
  getCurrentTime(): number {
    if (!this.firstAudioPlayed || this.stopped) return 0;
    const elapsed = this.audioContext.currentTime - this.playbackStartContextTime;
    return Math.max(0, Math.min(elapsed, this.totalScheduledDuration));
  }

  // Get total duration of all scheduled audio
  getTotalDuration(): number {
    return this.totalScheduledDuration;
  }

  // Stop playback and return current position for seamless handoff
  stopAndGetPosition(): number {
    const currentTime = this.getCurrentTime();
    this.stopped = true;
    this.audioContext.close();
    return currentTime;
  }

  stop(): void {
    this.stopped = true;
    this.audioContext.close();
  }
}

// Global player reference for stop functionality
let currentPlayer: HybridStreamingPlayer | null = null;

interface StreamingTTSResult {
  blob: Blob;
  blobUrl: string;
  currentTime: number; // Position when streaming completed, for seamless handoff
}

/**
 * Start streaming TTS playback (hybrid approach)
 * - Plays immediately via Web Audio API
 * - Returns blob URL and current position for seamless handoff to native <audio> controls
 */
async function startStreamingTTS(
  text: string,
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

  console.log("[TTS] Starting streaming fetch to", TTS_SERVER_URL);

  try {
    const response = await fetch(`${TTS_SERVER_URL}/tts`, {
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

    // Flush any remaining audio - DON'T flush, we want to hand off at current position
    // currentPlayer.flush();

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

function stopStreamingTTS(): void {
  if (currentPlayer) {
    currentPlayer.stop();
    currentPlayer = null;
  }
}

interface ViewerToolbarProps {
  clip: LocalClip;
  isEditMode: boolean;
  onEditModeChange: (enabled: boolean) => void;
  onSettingsClick: () => void;
  onSave: (content: string) => Promise<void>;
  isSaving: boolean;
}

export function ViewerToolbar({
  clip,
  isEditMode,
  onEditModeChange,
  onSettingsClick,
  onSave,
  isSaving,
}: ViewerToolbarProps) {
  const navigate = useNavigate();
  const { updateClip } = useClips();
  const { copyShareUrl } = useShareUrl();
  const [isTidying, setIsTidying] = useState(false);
  const [editContent, setEditContent] = useState(clip.dom_content);
  const [isSharing, setIsSharing] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isTTSStreaming, setIsTTSStreaming] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioHandoffTime, setAudioHandoffTime] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleTidy = async () => {
    setIsTidying(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "tidyContent",
        domContent: clip.dom_content,
      });
      if (response?.data) {
        setEditContent(response.data);
        await updateClip(clip.id, { dom_content: response.data });
      }
    } catch (err) {
      console.error("Failed to tidy content:", err);
    } finally {
      setIsTidying(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateClip(clip.id, { dom_content: editContent });
      onEditModeChange(false);
      await onSave(editContent);
    } catch (err) {
      console.error("Failed to save clip:", err);
    }
  };

  // Seamless handoff: when audio element is ready with a handoff time, seek and play
  useEffect(() => {
    if (audioRef.current && audioBlobUrl && audioHandoffTime !== null) {
      const audio = audioRef.current;
      audio.currentTime = audioHandoffTime;
      audio.play().catch((err) => {
        console.error("[TTS] Failed to auto-play after handoff:", err);
      });
      // Clear the handoff time after applying
      setAudioHandoffTime(null);
    }
  }, [audioBlobUrl, audioHandoffTime]);

  const handleReset = async () => {
    // Reset to original content - would need to refetch from storage
    window.location.reload();
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      // Always sync the clip to ensure highlights are up to date
      const response = await chrome.runtime.sendMessage({
        action: "syncSingleClip",
        clipId: clip.id,
      });

      if (!response?.success || !response?.data?.share_id) {
        const errorMsg = response?.error || "Failed to sync clip. Is AgentDB configured?";
        throw new Error(errorMsg);
      }

      const shareId = response.data.share_id;

      if (!shareId) {
        throw new Error("Share ID is required");
      }

      await copyShareUrl(shareId);
    } catch (err) {
      console.error("Failed to share clip:", err);
      // Import showToast if not already imported
      const { showToast } = await import("@/lib/toast");
      showToast(err instanceof Error ? err.message : "Failed to share clip");
    } finally {
      setIsSharing(false);
    }
  };

  const handleTTS = useCallback(async () => {
    // If already streaming, stop
    if (isTTSStreaming) {
      stopStreamingTTS();
      setIsTTSStreaming(false);
      setIsTTSLoading(false);
      return;
    }

    const textContent = clip.text_content?.trim();
    console.log("[TTS] handleTTS called, textContent length:", textContent?.length);
    if (!textContent) {
      showToast("No content to read");
      return;
    }

    // Clean up previous blob URL if exists
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
      setAudioBlobUrl(null);
    }

    setIsTTSLoading(true);

    // Check cache first
    const cachedUrl = await getCachedAudio(clip.id, textContent, "alba");
    if (cachedUrl) {
      console.log("[TTS] Using cached audio");
      setIsTTSLoading(false);
      setAudioBlobUrl(cachedUrl);
      setAudioHandoffTime(0); // Start from beginning
      return;
    }

    startStreamingTTS(
      textContent,
      "alba",
      // onFirstAudio - audio started playing
      () => {
        console.log("[TTS] First audio chunk playing");
        setIsTTSLoading(false);
        setIsTTSStreaming(true);
      },
      // onComplete - streaming finished, seamless handoff to audio element
      async (result) => {
        console.log("[TTS] Stream complete, handing off at:", result.currentTime.toFixed(2) + "s");
        setIsTTSStreaming(false);
        setAudioHandoffTime(result.currentTime);
        setAudioBlobUrl(result.blobUrl);

        // Cache the audio for future use
        await cacheAudio(clip.id, result.blob, textContent, "alba");
      },
      // onError
      (error) => {
        showToast(error.message || "Failed to generate speech");
        setIsTTSLoading(false);
        setIsTTSStreaming(false);
      },
    );
  }, [clip.id, clip.text_content, isTTSStreaming, audioBlobUrl]);

  const handleStopTTS = useCallback(() => {
    stopStreamingTTS();
    setIsTTSStreaming(false);
    setIsTTSLoading(false);
  }, []);

  const handleCloseAudioPlayer = useCallback(() => {
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
      setAudioBlobUrl(null);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [audioBlobUrl]);

  const toolbarBtnClass =
    "bg-black/5 dark:bg-white/5 border-none w-9 h-9 rounded flex items-center justify-center cursor-pointer text-muted-foreground text-sm transition-colors hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed";
  const toolbarBtnActiveClass = "bg-black/15 dark:bg-white/15 text-foreground";

  return (
    <>
      <div className="fixed top-4 right-4 flex gap-1 z-[100] md:top-3 md:right-3">
        <button className={toolbarBtnClass} onClick={() => navigate(-1)} title="Back to clips">
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="w-4" />

        {isEditMode ? (
          <>
            <button
              className={cn(toolbarBtnClass, toolbarBtnActiveClass)}
              onClick={handleSave}
              disabled={isSaving}
              title="Save changes"
            >
              ✓
            </button>
            <button
              className={toolbarBtnClass}
              onClick={() => onEditModeChange(false)}
              disabled={isSaving}
              title="Cancel editing"
            >
              ×
            </button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={toolbarBtnClass} title="More options">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSettingsClick}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditModeChange(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleTidy} disabled={isTidying}>
                <ScrollText className="h-4 w-4" />
                {isTidying ? "Tidying..." : "Tidy Content"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reset Content
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleShare} disabled={isSharing}>
                <Share2 className="h-4 w-4" />
                {isSharing ? "Sharing..." : clip.share_id ? "Copy Share URL" : "Share"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleTTS} disabled={isTTSLoading || isTTSStreaming}>
                <Volume2 className="h-4 w-4" />
                {isTTSLoading ? "Loading..." : isTTSStreaming ? "Stop Reading" : "Read Aloud"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Floating TTS status indicator (during streaming) */}
      {(isTTSLoading || isTTSStreaming) && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-lg shadow-lg z-[200]">
          <Volume2
            className={`h-4 w-4 ${isTTSStreaming ? "text-primary" : "text-muted-foreground"}`}
          />
          <span className="text-sm">{isTTSLoading ? "Loading..." : "Streaming..."}</span>
          <button
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={handleStopTTS}
            title="Stop"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Audio player for replay (after streaming completes) */}
      {audioBlobUrl && !isTTSStreaming && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-card border border-border p-3 rounded-lg shadow-lg z-[200]">
          <audio
            ref={audioRef}
            controls
            src={audioBlobUrl}
            className="h-8"
            onEnded={() => {
              // Keep the player available for replay
            }}
          />
          <button
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={handleCloseAudioPlayer}
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
