import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useClips } from "@/hooks/useClips";
import { useShareUrl } from "@/hooks/useShareUrl";
import { useTtsUrl } from "@/hooks/useTtsUrl";
import { getCachedAudio, cacheAudio } from "@/hooks/useTTSCache";
import type { LocalClip } from "@repo/shared";
import {
  startStreamingTTS,
  stopStreamingTTS,
  pauseStreamingTTS,
  resumeStreamingTTS,
  checkTTSServerAvailable,
  type StreamingTTSResult,
} from "@repo/shared/tts";
import {
  ArrowLeft,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ViewerToolbarProps {
  clip: LocalClip;
  isEditMode: boolean;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onEditModeChange: (enabled: boolean) => void;
  onSettingsClick: () => void;
  onSave: (content: string) => Promise<void>;
  isSaving: boolean;
  tidyModeActive: boolean;
  onToggleTidyMode: () => Promise<void>;
}

export function ViewerToolbar({
  clip,
  isEditMode,
  editContent,
  onEditContentChange,
  onEditModeChange,
  onSettingsClick,
  onSave,
  isSaving,
  tidyModeActive,
  onToggleTidyMode,
}: ViewerToolbarProps) {
  const navigate = useNavigate();
  const { updateClip } = useClips();
  const { copyShareUrl } = useShareUrl();
  const { ttsUrl } = useTtsUrl();
  const [isSharing, setIsSharing] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isTTSStreaming, setIsTTSStreaming] = useState(false);
  const [isTTSPaused, setIsTTSPaused] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioHandoffTime, setAudioHandoffTime] = useState<number | null>(null);
  const [showTTSServerDialog, setShowTTSServerDialog] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

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

    // Check if TTS server is available before streaming
    const isServerAvailable = await checkTTSServerAvailable(ttsUrl);
    if (!isServerAvailable) {
      console.log("[TTS] Server not available at", ttsUrl);
      setIsTTSLoading(false);
      setShowTTSServerDialog(true);
      return;
    }

    startStreamingTTS(
      textContent,
      ttsUrl,
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
  }, [clip.id, clip.text_content, isTTSStreaming, audioBlobUrl, ttsUrl]);

  const handleStopTTS = useCallback(() => {
    stopStreamingTTS();
    setIsTTSStreaming(false);
    setIsTTSLoading(false);
    setIsTTSPaused(false);
  }, []);

  const handlePauseTTS = useCallback(() => {
    pauseStreamingTTS();
    setIsTTSPaused(true);
  }, []);

  const handleResumeTTS = useCallback(() => {
    resumeStreamingTTS();
    setIsTTSPaused(false);
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
              <DropdownMenuItem onClick={onToggleTidyMode}>
                <ScrollText className="h-4 w-4" />
                {tidyModeActive ? "Done Tidying" : "Tidy Content"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset} disabled={tidyModeActive}>
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

      {/* Unified TTS audio player with streaming overlay */}
      {(isTTSLoading || isTTSStreaming || audioBlobUrl) && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-card border border-border p-3 rounded-lg shadow-lg z-[200]">
          {/* Audio player container with overlay during streaming */}
          <div className="relative">
            <audio
              ref={audioRef}
              controls
              src={audioBlobUrl || undefined}
              className={`h-8 ${isTTSLoading || isTTSStreaming ? "opacity-40 pointer-events-none" : ""}`}
              onEnded={() => {
                // Keep the player available for replay
              }}
            />
            {/* Streaming overlay */}
            {(isTTSLoading || isTTSStreaming) && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-card/80 rounded">
                <Volume2
                  className={`h-4 w-4 ${isTTSStreaming && !isTTSPaused ? "text-primary animate-pulse" : "text-muted-foreground"}`}
                />
                <span className="text-sm font-medium">
                  {isTTSLoading ? "Loading..." : isTTSPaused ? "Paused" : "Streaming..."}
                </span>
              </div>
            )}
          </div>
          {/* Pause/Resume button - only show when streaming (not loading) */}
          {isTTSStreaming && (
            <button
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={isTTSPaused ? handleResumeTTS : handlePauseTTS}
              title={isTTSPaused ? "Resume" : "Pause"}
            >
              {isTTSPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
          <button
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={isTTSLoading || isTTSStreaming ? handleStopTTS : handleCloseAudioPlayer}
            title={isTTSLoading || isTTSStreaming ? "Stop" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TTS Server Unavailable Dialog */}
      <Dialog open={showTTSServerDialog} onOpenChange={setShowTTSServerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TTS Server Unavailable</DialogTitle>
            <DialogDescription>
              The text-to-speech server is not running. Please start the pocket-tts server to use
              this feature.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 font-mono text-sm">pocket-tts serve</div>
          <DialogFooter>
            <button
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
              onClick={() => setShowTTSServerDialog(false)}
            >
              Got it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
