import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useClips } from "@/hooks/useClips";
import { useHighlights, useHighlightSync } from "@/hooks/useHighlights";
import type { LocalClip, ElementClip, Clip, Highlight } from "@repo/shared";
import { getHtmlChunks } from "@repo/shared/utils";
import { ViewerToolbar } from "./ViewerToolbar";
import { SettingsPanel } from "./SettingsPanel";
import { HighlightPopover, type HighlightPopoverHandle } from "./HighlightPopover";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";

export function ClipViewer() {
  const { clipId } = useParams<{ clipId: string }>();
  const { getClip } = useClips();
  const { addHighlight, updateNote, deleteHighlight } = useHighlights();
  const [clip, setClip] = useState<Clip | null>(null);
  const [activeTab, setActiveTab] = useState<"text" | "markdown" | "html" | "css">("text");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [tidyModeActive, setTidyModeActive] = useState(false);
  const activeHighlightIdRef = useRef<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HighlightPopoverHandle>(null);
  const lastHighlightIdsRef = useRef<string>("");
  const lastContentRef = useRef<string>("");
  const originalContentRef = useRef<string>("");

  // Subscribe to highlight changes from other views (reader mode, etc.)
  const handleHighlightsChange = useCallback((newHighlights: Highlight[]) => {
    setHighlights(newHighlights);
  }, []);

  useHighlightSync(clipId, handleHighlightsChange);

  const handleCopyHighlights = useCallback(async () => {
    if (!clip || highlights.length === 0) {
      showToast("No highlights to copy");
      return;
    }

    const title = "title" in clip ? clip.title : clip.pageTitle;
    const url = clip.url;

    const lines: string[] = [];
    lines.push(`[${title}](${url})`);
    lines.push("");

    const sortedHighlights = [...highlights].sort((a, b) => a.startOffset - b.startOffset);

    for (const highlight of sortedHighlights) {
      const text = highlight.text?.trim();
      if (!text) continue;

      lines.push(`> ${text}`);
      lines.push("");

      if (highlight.note && highlight.note.trim()) {
        lines.push(highlight.note.trim());
        lines.push("");
      }
    }

    const markdown = lines.join("\n").trim();
    if (!markdown) {
      showToast("No highlights to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      showToast("Highlights copied");
    } catch (error) {
      console.error("Failed to copy highlights:", error);
      showToast("Failed to copy highlights");
    }
  }, [clip, highlights]);

  // Setup reading progress indicator
  useEffect(() => {
    const progressBar = progressBarRef.current;
    if (!progressBar) return;

    const updateProgress = (): void => {
      if (!progressBar) return;

      // Use document/body scroll instead of container
      const scrollTop =
        window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollableHeight = scrollHeight - clientHeight;

      if (scrollableHeight <= 0) {
        progressBar.style.setProperty("--scroll-progress", "0%");
        return;
      }

      const progress = Math.min(100, Math.max(0, (scrollTop / scrollableHeight) * 100));
      progressBar.style.setProperty("--scroll-progress", `${progress}%`);
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      updateProgress();
      // Also update after a short delay to catch any async content loading
      setTimeout(updateProgress, 100);
    });

    window.addEventListener("scroll", updateProgress, { passive: true });
    // Also listen for resize to handle content changes
    window.addEventListener("resize", updateProgress, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [clip, editContent, isLoading]); // Re-run when content changes or loading completes

  // Load clip on mount
  useEffect(() => {
    const loadClip = async () => {
      if (!clipId) {
        setError("No clip ID provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const loadedClip = await getClip(clipId);
        if (loadedClip) {
          setClip(loadedClip);
          // Only set edit content for LocalClip
          if (!("type" in loadedClip) || loadedClip.type !== "element") {
            const localClip = loadedClip as LocalClip;
            setEditContent(localClip.dom_content);
            setHighlights(localClip.highlights || []);
          }
        } else {
          setError("Clip not found");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load clip";
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadClip();
  }, [clipId, getClip]);

  // Set content when entering edit mode (since dangerouslySetInnerHTML is disabled in edit mode)
  useEffect(() => {
    if (isEditMode && contentRef.current) {
      contentRef.current.innerHTML = editContent;
    }
  }, [isEditMode]);

  // Restore highlights in DOM when content or highlights structurally change
  useEffect(() => {
    if (!contentRef.current || isEditMode) return;

    // Check if highlights actually changed (not just note updates)
    const currentIds = highlights
      .map((h) => h.id)
      .sort()
      .join(",");
    const idsChanged = currentIds !== lastHighlightIdsRef.current;
    const contentChanged = editContent !== lastContentRef.current;

    // Use requestAnimationFrame to ensure DOM is updated after dangerouslySetInnerHTML
    const rafId = requestAnimationFrame(() => {
      if (!contentRef.current) return;

      // Check if marks actually exist in DOM (dangerouslySetInnerHTML may have cleared them)
      const existingMarks = contentRef.current.querySelectorAll(".viewer-highlight");
      const marksExist = existingMarks.length > 0;

      // Need to restore if: IDs changed, content changed, first render, or marks missing
      const needsRestore =
        idsChanged ||
        contentChanged ||
        !lastHighlightIdsRef.current ||
        (highlights.length > 0 && !marksExist);

      if (needsRestore) {
        // Remember active highlight before clearing
        const activeId =
          activeHighlightIdRef.current ||
          contentRef.current
            .querySelector(".viewer-highlight.active")
            ?.getAttribute("data-highlight-id");

        // Clear existing marks
        existingMarks.forEach((mark) => {
          const parent = mark.parentNode;
          if (parent) {
            while (mark.firstChild) {
              parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
          }
        });

        // Restore highlights
        if (highlights.length > 0) {
          const sorted = [...highlights].sort((a, b) => b.startOffset - a.startOffset);
          for (const hl of sorted) {
            try {
              restoreHighlight(hl);
            } catch {
              console.warn("Could not restore highlight:", hl.text.slice(0, 30));
            }
          }
        }

        // Restore active state if there was one
        if (activeId) {
          const activeMark = contentRef.current.querySelector(`[data-highlight-id="${activeId}"]`);
          if (activeMark) {
            activeMark.classList.add("active");
          }
        }

        lastHighlightIdsRef.current = currentIds;
        lastContentRef.current = editContent;
      } else {
        // Just update has-note class without recreating marks
        highlights.forEach((hl) => {
          const mark = contentRef.current?.querySelector(`[data-highlight-id="${hl.id}"]`);
          if (mark) {
            mark.classList.toggle("has-note", !!hl.note);
          }
        });
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [highlights, isEditMode, editContent]);

  // Load screenshot for element clips
  useEffect(() => {
    if (!clip || !("type" in clip) || clip.type !== "element") {
      setScreenshotUrl(null);
      return;
    }

    const elementClip = clip as ElementClip;
    if (!elementClip.screenshotAssetId) {
      setScreenshotUrl(null);
      return;
    }

    chrome.runtime.sendMessage(
      { action: "getClipAsset", assetId: elementClip.screenshotAssetId },
      (response) => {
        if (response?.dataUrl) {
          setScreenshotUrl(response.dataUrl);
        }
      },
    );
  }, [clip]);

  // Document-level click handler to close popover when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // If no active highlight, nothing to do
      if (!activeHighlightIdRef.current) return;

      const target = e.target as HTMLElement;

      // If click is inside the popover, ignore
      if (popoverRef.current?.contains(target)) return;

      // If click is on a highlight, let handleContentClick handle it
      if (target.closest(".viewer-highlight")) return;

      // Click was outside - save and close
      handleSaveNote();
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [highlights]); // Need highlights in deps for handleSaveNote

  const restoreHighlight = (highlight: Highlight) => {
    if (!contentRef.current) return;

    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null);

    let currentOffset = 0;
    let node: Node | null = null;

    while ((node = walker.nextNode())) {
      const nodeLength = node.textContent?.length || 0;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + nodeLength;

      if (nodeEnd > highlight.startOffset && nodeStart < highlight.endOffset) {
        const mark = document.createElement("mark");
        mark.className = "viewer-highlight";
        mark.dataset.highlightId = highlight.id;
        if (highlight.note) {
          mark.classList.add("has-note");
        }

        const range = document.createRange();
        const startOffset = Math.max(0, highlight.startOffset - nodeStart);
        const endOffset = Math.min(nodeLength, highlight.endOffset - nodeStart);

        range.setStart(node, startOffset);
        range.setEnd(node, endOffset);
        range.surroundContents(mark);
        return;
      }

      currentOffset = nodeEnd;
    }
  };

  const getTextOffset = (
    container: Node | null,
    targetNode: Node,
    targetOffset: number,
  ): number => {
    if (!container) return 0;

    let offset = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

    let node: Node | null = null;
    while ((node = walker.nextNode())) {
      if (node === targetNode) {
        return offset + targetOffset;
      }
      offset += node.textContent?.length || 0;
    }

    return offset;
  };

  const handleContentMouseUp = async (e: React.MouseEvent) => {
    // Skip highlighting when shift is held - allow normal text selection for copying
    if (e.shiftKey) return;

    if (isEditMode || !clip) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) return;

    const container = contentRef.current;
    if (!container) return;

    // Check if selection is within our content
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !container.contains(anchorNode)) return;

    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const startOffset = getTextOffset(container, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(container, range.endContainer, range.endOffset);

    try {
      const newHighlight = await addHighlight(clip.id, {
        text,
        startOffset,
        endOffset,
        color: "yellow",
      });

      if (newHighlight) {
        setHighlights((prev) => {
          if (prev.some((h) => h.id === newHighlight.id)) return prev;
          return [...prev, newHighlight];
        });
      }

      selection.removeAllRanges();
    } catch (error) {
      console.error("Failed to create highlight:", error);
    }
  };

  // Handle click on content - show popover for highlights, hide for clicks outside
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mark = target.closest(".viewer-highlight") as HTMLElement;

    if (!mark) {
      // Clicked outside highlight - save and hide
      if (activeHighlightIdRef.current) {
        handleSaveNote();
      }
      return;
    }

    const highlightId = mark.dataset.highlightId;
    if (!highlightId) return;

    // If clicking different highlight, save current first
    if (activeHighlightIdRef.current && activeHighlightIdRef.current !== highlightId) {
      handleSaveNote();
    }

    // Clear previous active and set new
    contentRef.current?.querySelectorAll(".viewer-highlight.active").forEach((el) => {
      el.classList.remove("active");
    });
    mark.classList.add("active");

    // Show popover
    activeHighlightIdRef.current = highlightId;
    const highlightData = highlights.find((h) => h.id === highlightId);

    // Set fallback position for browsers without anchor positioning
    const rect = mark.getBoundingClientRect();
    popoverRef.current?.setFallbackPosition(rect.top, rect.right + 24);
    popoverRef.current?.show(highlightData?.note || "");
  };

  // Save note and close popover
  const handleSaveNote = async () => {
    const highlightId = activeHighlightIdRef.current;
    if (!clip || !highlightId) return;

    const note = popoverRef.current?.getNote() || "";

    try {
      await updateNote(clip.id, highlightId, note);
      setHighlights(highlights.map((h) => (h.id === highlightId ? { ...h, note } : h)));

      // Update has-note class
      const markElement = contentRef.current?.querySelector(`[data-highlight-id="${highlightId}"]`);
      markElement?.classList.toggle("has-note", !!note);
    } catch (error) {
      console.error("Failed to save note:", error);
    }

    // Hide and clear
    popoverRef.current?.hide();
    contentRef.current?.querySelectorAll(".viewer-highlight.active").forEach((el) => {
      el.classList.remove("active");
    });
    activeHighlightIdRef.current = null;
  };

  // Delete highlight and close popover
  const handleDeleteHighlight = async () => {
    const highlightId = activeHighlightIdRef.current;
    if (!clip || !highlightId) return;

    try {
      await deleteHighlight(clip.id, highlightId);
      setHighlights(highlights.filter((h) => h.id !== highlightId));
    } catch (error) {
      console.error("Failed to delete highlight:", error);
    }

    popoverRef.current?.hide();
    activeHighlightIdRef.current = null;
  };

  // Get current highlight text for copy
  const getHighlightText = () => {
    const highlightId = activeHighlightIdRef.current;
    return highlights.find((h) => h.id === highlightId)?.text || "";
  };

  // =========================================================================
  // Manual Tidy Mode
  // =========================================================================

  /**
   * Handle individual chunk tidy click
   */
  const handleChunkTidy = useCallback(async (chunkId: string): Promise<void> => {
    const container = contentRef.current;
    if (!container) return;

    const chunkEl = container.querySelector(`[data-tidy-chunk="${chunkId}"]`);
    if (!chunkEl) {
      console.warn(`[Tidy Content] Chunk not found: ${chunkId}`);
      return;
    }

    const contentEl = chunkEl.querySelector(".tidy-chunk-content");
    if (!contentEl) {
      console.warn(`[Tidy Content] Chunk content not found: ${chunkId}`);
      return;
    }

    const chunkHtml = contentEl.innerHTML;

    // Set loading state
    chunkEl.classList.add("loading");
    const buttons = chunkEl.querySelectorAll(".tidy-chunk-btn") as NodeListOf<HTMLButtonElement>;
    buttons.forEach((btn) => (btn.disabled = true));

    try {
      const response = await chrome.runtime.sendMessage({
        action: "tidyContent",
        domContent: chunkHtml,
      });

      if (response?.success && response?.data) {
        contentEl.innerHTML = response.data;
      } else {
        showToast("Tidy failed for this section");
        console.error(`[Tidy Content] Failed to tidy chunk ${chunkId}:`, response?.error);
      }
    } catch (err) {
      console.error(`[Tidy Content] Error tidying chunk ${chunkId}:`, err);
      showToast("Tidy failed for this section");
    } finally {
      chunkEl.classList.remove("loading");
      buttons.forEach((btn) => (btn.disabled = false));
    }
  }, []);

  /**
   * Handle remove chunk click
   */
  const handleRemoveChunk = useCallback((chunkId: string): void => {
    const container = contentRef.current;
    if (!container) return;

    const chunk = container.querySelector(`[data-tidy-chunk="${chunkId}"]`);
    if (chunk) {
      chunk.remove();
    }
  }, []);

  /**
   * Enter tidy mode - split content into chunks with action buttons
   */
  const enterTidyMode = useCallback(async (): Promise<void> => {
    const container = contentRef.current;
    if (!container || tidyModeActive) return;

    try {
      // Store original content for potential reset
      originalContentRef.current = editContent;

      // Split content into chunks
      const chunks = getHtmlChunks(editContent);

      if (chunks.length === 0) {
        showToast("Content too short to chunk");
        return;
      }

      // Clear container and add chunk wrappers
      container.innerHTML = "";

      for (const chunk of chunks) {
        const chunkDiv = document.createElement("div");
        chunkDiv.className = "tidy-chunk";
        chunkDiv.setAttribute("data-tidy-chunk", chunk.id);

        // Content wrapper
        const contentWrapper = document.createElement("div");
        contentWrapper.className = "tidy-chunk-content";
        contentWrapper.innerHTML = chunk.html;

        // Controls
        const controls = document.createElement("div");
        controls.className = "tidy-chunk-controls";
        controls.setAttribute("data-chunk-controls", chunk.id);

        // Tidy button
        const tidyBtn = document.createElement("button");
        tidyBtn.className = "tidy-chunk-btn";
        tidyBtn.setAttribute("data-action", "tidy");
        tidyBtn.setAttribute("title", "Tidy this section");
        tidyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/></svg>`;
        tidyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleChunkTidy(chunk.id);
        });

        // Remove button
        const removeBtn = document.createElement("button");
        removeBtn.className = "tidy-chunk-btn";
        removeBtn.setAttribute("data-action", "remove");
        removeBtn.setAttribute("title", "Remove this section");
        removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleRemoveChunk(chunk.id);
        });

        controls.appendChild(tidyBtn);
        controls.appendChild(removeBtn);
        chunkDiv.appendChild(controls);
        chunkDiv.appendChild(contentWrapper);
        container.appendChild(chunkDiv);
      }

      setTidyModeActive(true);
      console.log(`[Tidy Content] Entered tidy mode with ${chunks.length} chunks`);
    } catch (err) {
      console.error("[Tidy Content] Failed to enter tidy mode:", err);
      showToast("Failed to enter tidy mode");
    }
  }, [tidyModeActive, editContent, handleChunkTidy, handleRemoveChunk]);

  /**
   * Exit tidy mode - save content and remove chunk UI
   */
  const exitTidyMode = useCallback(async (): Promise<void> => {
    const container = contentRef.current;
    if (!container || !tidyModeActive) return;

    try {
      // Get cleaned content (without chunk wrappers)
      const clone = container.cloneNode(true) as HTMLElement;

      // Remove all chunk controls
      clone.querySelectorAll(".tidy-chunk-controls").forEach((ctrl) => ctrl.remove());

      // Unwrap chunk divs
      clone.querySelectorAll(".tidy-chunk").forEach((chunk) => {
        const content = chunk.querySelector(".tidy-chunk-content");
        if (content) {
          chunk.replaceWith(...Array.from(content.childNodes));
        }
      });

      // Unwrap any remaining content wrappers
      clone.querySelectorAll(".tidy-chunk-content").forEach((wrapper) => {
        const fragment = document.createDocumentFragment();
        while (wrapper.firstChild) {
          fragment.appendChild(wrapper.firstChild);
        }
        wrapper.replaceWith(fragment);
      });

      const finalHtml = clone.innerHTML;

      // Update the clip with new content
      if (clip) {
        await chrome.runtime.sendMessage({
          action: "updateLocalClip",
          clipId: clip.id,
          updates: { dom_content: finalHtml },
        });
      }

      // Update local state
      setEditContent(finalHtml);
      setTidyModeActive(false);

      // Re-render with cleaned content
      container.innerHTML = finalHtml;

      showToast("Content saved");
      console.log("[Tidy Content] Exited tidy mode, content saved");
    } catch (err) {
      console.error("[Tidy Content] Failed to exit tidy mode:", err);
      showToast("Failed to save content");
    }
  }, [tidyModeActive, clip]);

  /**
   * Toggle tidy mode
   */
  const toggleTidyMode = useCallback(async (): Promise<void> => {
    if (tidyModeActive) {
      await exitTidyMode();
    } else {
      await enterTidyMode();
    }
  }, [tidyModeActive, enterTidyMode, exitTidyMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-muted overflow-y-auto overflow-x-hidden">
        <div className="max-w-[680px] mx-auto py-12 px-6 bg-background min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading clip...</p>
        </div>
      </div>
    );
  }

  if (error || !clip) {
    return (
      <div className="min-h-screen w-full bg-muted overflow-y-auto overflow-x-hidden">
        <div className="max-w-[680px] mx-auto py-12 px-6 bg-background min-h-screen flex flex-col items-center justify-center">
          <p className="text-destructive text-sm">{error || "Clip not found"}</p>
        </div>
      </div>
    );
  }

  // Check if this is an element clip
  const isElementClip = "type" in clip && clip.type === "element";
  const elementClip = isElementClip ? (clip as ElementClip) : null;

  return (
    <div
      className="min-h-screen w-full bg-muted overflow-y-auto overflow-x-hidden relative"
      ref={wrapperRef}
    >
      {!isElementClip && (
        <>
          <ViewerToolbar
            clip={clip as LocalClip}
            isEditMode={isEditMode}
            editContent={editContent}
            onEditContentChange={setEditContent}
            onEditModeChange={setIsEditMode}
            onSettingsClick={() => setShowSettings(!showSettings)}
            onSave={async (newContent) => {
              setIsSaving(true);
              try {
                setEditContent(newContent);
                setIsEditMode(false);
              } finally {
                setIsSaving(false);
              }
            }}
            isSaving={isSaving}
            tidyModeActive={tidyModeActive}
            onToggleTidyMode={toggleTidyMode}
            onCopyHighlights={handleCopyHighlights}
            hasHighlights={highlights.length > 0}
          />
          {/* Progress bar */}
          <div
            ref={progressBarRef}
            className="fixed top-14 left-0 right-0 h-0.5 bg-transparent z-[99] pointer-events-none before:content-[''] before:absolute before:top-0 before:left-0 before:h-full before:bg-muted-foreground/40 before:transition-[width] before:duration-100 before:ease-linear"
            style={{ "--scroll-progress": "0%" } as React.CSSProperties}
          />
        </>
      )}

      {showSettings && <SettingsPanel />}

      <div
        className={cn(
          "max-w-[680px] mx-auto px-6 pt-12 pb-20 bg-background min-h-screen relative md:px-5 md:pt-8 md:pb-16 sm:px-4 sm:pt-6 sm:pb-12",
          tidyModeActive && "tidy-mode",
        )}
      >
        {/* Header */}
        <header className="mb-8 pb-6 border-b border-[var(--border-light)]">
          <h1 className="font-semibold text-[28px] leading-tight text-foreground m-0 tracking-tight md:text-2xl sm:text-[22px]">
            {isElementClip && elementClip
              ? elementClip.aiTitle || `${elementClip.elementMeta.tagName} Element`
              : (clip as LocalClip).title}
          </h1>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <a
              href={clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground no-underline break-all border-none transition-colors duration-150 hover:text-foreground hover:underline"
            >
              {new URL(clip.url).hostname}
            </a>
            <span className="text-muted-foreground">•</span>
            <time>
              {new Date(
                isElementClip && elementClip
                  ? elementClip.createdAt
                  : (clip as LocalClip).created_at,
              ).toLocaleDateString()}
            </time>
          </div>
        </header>

        {/* Element Clip Rendering */}
        {isElementClip && elementClip && (
          <div className="flex flex-col gap-6">
            {/* Screenshot Image */}
            {screenshotUrl && (
              <div className="mb-3">
                <img
                  src={screenshotUrl}
                  alt="Element screenshot"
                  className="max-w-full h-auto rounded-md block"
                />
              </div>
            )}

            {/* AI Summary */}
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-foreground m-0">Summary</h2>
              <p className="m-0 text-[var(--text-secondary)] leading-relaxed">
                {elementClip.aiSummaryStatus === "pending"
                  ? "Generating summary..."
                  : elementClip.aiSummary || "No summary"}
              </p>
            </div>

            {/* Element Metadata */}
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-foreground m-0">Element Info</h2>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                      Tag
                    </th>
                    <td className="py-2.5 px-3 text-foreground border-b border-border break-words">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">
                        &lt;{elementClip.elementMeta.tagName}&gt;
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                      Selector
                    </th>
                    <td className="py-2.5 px-3 text-foreground border-b border-border break-words">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">
                        {elementClip.selector}
                      </code>
                    </td>
                  </tr>
                  {elementClip.elementMeta.role && (
                    <tr>
                      <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                        Role
                      </th>
                      <td className="py-2.5 px-3 text-foreground border-b border-border break-words">
                        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">
                          {elementClip.elementMeta.role}
                        </code>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                      Dimensions
                    </th>
                    <td className="py-2.5 px-3 text-foreground border-b border-border break-words">
                      {Math.round(elementClip.elementMeta.boundingBox.width)}×
                      {Math.round(elementClip.elementMeta.boundingBox.height)}px
                    </td>
                  </tr>
                  {elementClip.elementMeta.classNames.length > 0 && (
                    <tr>
                      <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                        Classes
                      </th>
                      <td className="py-2.5 px-3 text-foreground border-b border-border break-words">
                        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">
                          {elementClip.elementMeta.classNames.join(" ")}
                        </code>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                      URL
                    </th>
                    <td className="py-2.5 px-3 text-foreground border-b border-border break-words">
                      <a
                        href={elementClip.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground no-underline border-b border-muted-foreground transition-colors hover:border-foreground"
                      >
                        {elementClip.url}
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                      Saved
                    </th>
                    <td className="py-2.5 px-3 text-foreground border-b border-border break-words">
                      {new Date(elementClip.createdAt).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabs for content */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 border-b border-border mb-3">
                {(["text", "markdown", "html", "css"] as const).map((tab) => (
                  <button
                    key={tab}
                    className={cn(
                      "py-2 px-3 bg-transparent border-none text-muted-foreground text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all hover:text-foreground",
                      activeTab === tab && "text-foreground border-b-foreground",
                    )}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "text"
                      ? "Text Content"
                      : tab === "markdown"
                        ? "Markdown"
                        : tab.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="bg-muted rounded p-3 overflow-x-auto">
                <pre className="m-0 font-mono text-xs leading-normal text-[var(--text-secondary)] whitespace-pre-wrap break-words">
                  {activeTab === "text" && (elementClip.textContent || "(empty)")}
                  {activeTab === "markdown" && (elementClip.markdownContent || "(empty)")}
                  {activeTab === "html" && elementClip.domStructure}
                  {activeTab === "css" && elementClip.scopedStyles}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Local Clip Rendering - prose styles applied inline */}
        {!isElementClip && (
          <div
            ref={contentRef}
            className={cn(
              "text-base leading-relaxed text-[var(--text-secondary)] break-words",
              "[&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:text-foreground [&_h1]:mt-8 [&_h1]:mb-2 [&_h1]:text-2xl",
              "[&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl",
              "[&_h3]:font-semibold [&_h3]:leading-tight [&_h3]:text-foreground [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg",
              "[&_h4]:font-semibold [&_h4]:leading-tight [&_h4]:text-foreground [&_h4]:mt-8 [&_h4]:mb-2 [&_h4]:text-base",
              "[&_p]:mb-5",
              "[&_a]:text-foreground [&_a]:no-underline [&_a]:border-b [&_a]:border-muted-foreground [&_a]:transition-colors hover:[&_a]:border-foreground",
              "[&_ul]:mb-5 [&_ul]:pl-6 [&_ol]:mb-5 [&_ol]:pl-6 [&_li]:mb-1",
              "[&_blockquote]:my-6 [&_blockquote]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:text-muted-foreground",
              "[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5",
              "[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-5 [&_pre]:text-sm [&_pre]:leading-normal",
              "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
              "[&_img]:max-w-full [&_img]:h-auto [&_img]:block [&_img]:my-6",
              "[&_table]:w-full [&_table]:border-collapse [&_table]:my-5 [&_table]:text-[0.9em]",
              "[&_th]:py-2 [&_th]:px-3 [&_th]:text-left [&_th]:border-b [&_th]:border-border [&_th]:font-semibold [&_th]:text-foreground",
              "[&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-border",
              "[&_hr]:border-none [&_hr]:border-t [&_hr]:border-[var(--border-light)] [&_hr]:my-8",
              "[&_figure]:my-6 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_figcaption]:mt-2",
              isEditMode && "outline-dashed outline-2 outline-border outline-offset-4",
            )}
            contentEditable={isEditMode}
            suppressContentEditableWarning
            onInput={(e) => setEditContent(e.currentTarget.innerHTML)}
            onMouseUp={handleContentMouseUp}
            onClick={handleContentClick}
            dangerouslySetInnerHTML={!isEditMode ? { __html: editContent } : undefined}
          />
        )}
      </div>

      {/* Highlight popover - always rendered, shown/hidden via CSS like reader mode */}
      {!isElementClip && (
        <HighlightPopover
          ref={popoverRef}
          onSave={handleSaveNote}
          onDelete={handleDeleteHighlight}
          getHighlightText={getHighlightText}
        />
      )}
    </div>
  );
}
