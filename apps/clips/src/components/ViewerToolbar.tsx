import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClips } from "@/hooks/useClips";
import { useShareUrl } from "@/hooks/useShareUrl";
import type { LocalClip } from "@repo/shared";
import { ArrowLeft, RotateCcw, ScrollText, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const handleReset = async () => {
    // Reset to original content - would need to refetch from storage
    window.location.reload();
  };

  const handleShare = async () => {
    if (!clip.share_id) return;
    setIsSharing(true);
    try {
      await copyShareUrl(clip.share_id);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="viewer-toolbar">
      <button className="viewer-btn" onClick={() => navigate(-1)} title="Back to clips">
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="toolbar-spacer" />

      {isEditMode ? (
        <>
          <button
            className={cn("viewer-btn", "active")}
            onClick={handleSave}
            disabled={isSaving}
            title="Save changes"
          >
            ✓
          </button>
          <button
            className="viewer-btn"
            onClick={() => onEditModeChange(false)}
            disabled={isSaving}
            title="Cancel editing"
          >
            ×
          </button>
        </>
      ) : (
        <>
          <button className="viewer-btn" onClick={onSettingsClick} title="Settings">
            Aa
          </button>
          <button className="viewer-btn" onClick={() => onEditModeChange(true)} title="Edit Mode">
            ✎
          </button>
          <button
            className={cn("viewer-btn", isTidying && "loading")}
            onClick={handleTidy}
            disabled={isTidying}
            title="Tidy Content"
          >
            <ScrollText className="h-4 w-4" strokeWidth={1} />
          </button>
          <button className="viewer-btn" onClick={handleReset} title="Reset Content">
            <RotateCcw className="h-4 w-4" strokeWidth={1} />
          </button>
          {clip.share_id && (
            <button
              className={cn("viewer-btn", isSharing && "loading")}
              onClick={handleShare}
              disabled={isSharing}
              title="Copy share URL"
            >
              <Share2 className="h-4 w-4" strokeWidth={1} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
