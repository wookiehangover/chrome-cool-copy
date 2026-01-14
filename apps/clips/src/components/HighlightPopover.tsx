import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Trash2, Copy, Check } from "lucide-react";

export interface HighlightPopoverHandle {
  show: (note: string) => void;
  hide: () => void;
  getNote: () => string;
  setFallbackPosition: (top: number, left: number) => void;
  contains: (element: HTMLElement) => boolean;
}

interface HighlightPopoverProps {
  onSave: () => void;
  onDelete: () => void;
  getHighlightText: () => string;
}

export const HighlightPopover = forwardRef<HighlightPopoverHandle, HighlightPopoverProps>(
  function HighlightPopover({ onSave, onDelete, getHighlightText }, ref) {
    const [copied, setCopied] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      show: (note: string) => {
        if (textareaRef.current) {
          textareaRef.current.value = note;
        }
        containerRef.current?.classList.add("visible");
        textareaRef.current?.focus();
      },
      hide: () => {
        containerRef.current?.classList.remove("visible");
      },
      getNote: () => textareaRef.current?.value || "",
      setFallbackPosition: (top: number, left: number) => {
        if (containerRef.current && !CSS.supports("anchor-name", "--test")) {
          containerRef.current.style.top = `${top}px`;
          containerRef.current.style.left = `${left}px`;
        }
      },
      contains: (element: HTMLElement) => containerRef.current?.contains(element) ?? false,
    }));

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(getHighlightText());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    };

    const handleDelete = () => {
      if (confirm("Delete this highlight?")) {
        onDelete();
      }
    };

    return (
      <div ref={containerRef} className="highlight-popover" onClick={(e) => e.stopPropagation()}>
        <textarea
          ref={textareaRef}
          placeholder="Add a note..."
          className="highlight-popover-textarea"
        />
        <div className="highlight-popover-actions">
          <button onClick={handleCopy} className="highlight-popover-btn-icon" title="Copy highlight">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button onClick={handleDelete} className="highlight-popover-btn-icon highlight-popover-btn-delete" title="Delete">
            <Trash2 size={14} />
          </button>
          <button onClick={onSave} className="highlight-popover-btn highlight-popover-btn-save">
            Save
          </button>
        </div>
      </div>
    );
  }
);
