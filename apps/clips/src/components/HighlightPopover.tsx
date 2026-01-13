import { useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";

interface HighlightPopoverProps {
  highlightId: string;
  initialNote: string;
  onSave: (note: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  position?: { top: number; left: number };
}

export function HighlightPopover({
  initialNote,
  onSave,
  onDelete,
  onClose,
  position,
}: HighlightPopoverProps) {
  const [note, setNote] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(note);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this highlight?")) return;
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const style = position
    ? {
        position: "absolute" as const,
        top: `${position.top}px`,
        left: `${position.left}px`,
      }
    : {};

  return (
    <div className="highlight-popover" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="highlight-popover-header">
        <h3 className="text-sm font-semibold">Add Note</h3>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note about this highlight..."
        className="highlight-popover-textarea"
      />

      <div className="highlight-popover-footer">
        <button
          onClick={handleDelete}
          disabled={isDeleting || isSaving}
          className="highlight-popover-btn highlight-popover-btn-delete"
          title="Delete highlight"
        >
          <Trash2 size={16} />
        </button>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="highlight-popover-btn highlight-popover-btn-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isDeleting}
            className="highlight-popover-btn highlight-popover-btn-save"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
