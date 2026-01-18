import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Trash2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      show: (note: string) => {
        if (textareaRef.current) {
          textareaRef.current.value = note;
        }
        setIsVisible(true);
        textareaRef.current?.focus();
      },
      hide: () => {
        setIsVisible(false);
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

    const iconBtnClass =
      "flex items-center justify-center p-1 bg-muted border-none rounded cursor-pointer text-muted-foreground transition-colors hover:bg-border hover:text-foreground";

    return (
      <div
        ref={containerRef}
        className={cn(
          "fixed w-[200px] bg-popover border border-border rounded p-2.5 shadow-md z-[1000] pointer-events-auto box-border",
          isVisible ? "block" : "hidden",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          ref={textareaRef}
          placeholder="Add a note..."
          className="block w-full min-h-[50px] py-1.5 px-2 border border-border rounded-sm bg-background text-foreground text-xs leading-snug resize-y mb-2 box-border focus:outline-none focus:border-muted-foreground placeholder:text-muted-foreground"
        />
        <div className="flex gap-1.5 items-center">
          <button onClick={handleCopy} className={iconBtnClass} title="Copy highlight">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            onClick={handleDelete}
            className={cn(iconBtnClass, "text-destructive hover:bg-destructive/10")}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onSave}
            className="ml-auto py-1 px-2 bg-muted border-none rounded-sm text-[11px] cursor-pointer text-muted-foreground transition-colors hover:bg-border hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    );
  },
);
