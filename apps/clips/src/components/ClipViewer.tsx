import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useClips } from "@/hooks/useClips";
import { useHighlights, useHighlightSync } from "@/hooks/useHighlights";
import type { LocalClip, ElementClip, Clip, Highlight } from "@repo/shared";
import { ViewerToolbar } from "./ViewerToolbar";
import { SettingsPanel } from "./SettingsPanel";
import { HighlightPopover, type HighlightPopoverHandle } from "./HighlightPopover";

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
  const activeHighlightIdRef = useRef<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HighlightPopoverHandle>(null);
  const lastHighlightIdsRef = useRef<string>("");
  const lastContentRef = useRef<string>("");

  // Subscribe to highlight changes from other views (reader mode, etc.)
  const handleHighlightsChange = useCallback((newHighlights: Highlight[]) => {
    setHighlights(newHighlights);
  }, []);

  useHighlightSync(clipId, handleHighlightsChange);

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

  if (isLoading) {
    return (
      <div className="viewer-wrapper">
        <div className="viewer-container flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading clip...</p>
        </div>
      </div>
    );
  }

  if (error || !clip) {
    return (
      <div className="viewer-wrapper">
        <div className="viewer-container flex flex-col items-center justify-center">
          <p className="text-destructive text-sm">{error || "Clip not found"}</p>
        </div>
      </div>
    );
  }

  // Check if this is an element clip
  const isElementClip = "type" in clip && clip.type === "element";
  const elementClip = isElementClip ? (clip as ElementClip) : null;

  return (
    <div className="viewer-wrapper" ref={wrapperRef}>
      {!isElementClip && (
        <>
          <ViewerToolbar
            clip={clip as LocalClip}
            isEditMode={isEditMode}
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
          />
          <div className="viewer-progress-bar" ref={progressBarRef} />
        </>
      )}

      {showSettings && <SettingsPanel />}

      <div className="viewer-container">
        {/* Header */}
        <header className="viewer-header">
          <h1 className="viewer-title">
            {isElementClip && elementClip
              ? elementClip.aiTitle || `${elementClip.elementMeta.tagName} Element`
              : (clip as LocalClip).title}
          </h1>
          <div className="viewer-meta">
            <a href={clip.url} target="_blank" rel="noopener noreferrer" className="viewer-url">
              {new URL(clip.url).hostname}
            </a>
            <span className="viewer-meta-separator">•</span>
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
          <div className="element-clip-container">
            {/* Screenshot Image */}
            {screenshotUrl && (
              <div className="element-screenshot">
                <img src={screenshotUrl} alt="Element screenshot" />
              </div>
            )}

            {/* AI Summary */}
            <div className="element-section">
              <h2>Summary</h2>
              <p className="element-summary">
                {elementClip.aiSummaryStatus === "pending"
                  ? "Generating summary..."
                  : elementClip.aiSummary || "No summary"}
              </p>
            </div>

            {/* Element Metadata */}
            <div className="element-section">
              <h2>Element Info</h2>
              <table className="element-metadata-table">
                <tbody>
                  <tr>
                    <th>Tag</th>
                    <td>
                      <code>&lt;{elementClip.elementMeta.tagName}&gt;</code>
                    </td>
                  </tr>
                  <tr>
                    <th>Selector</th>
                    <td>
                      <code>{elementClip.selector}</code>
                    </td>
                  </tr>
                  {elementClip.elementMeta.role && (
                    <tr>
                      <th>Role</th>
                      <td>
                        <code>{elementClip.elementMeta.role}</code>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <th>Dimensions</th>
                    <td>
                      {Math.round(elementClip.elementMeta.boundingBox.width)}×
                      {Math.round(elementClip.elementMeta.boundingBox.height)}px
                    </td>
                  </tr>
                  {elementClip.elementMeta.classNames.length > 0 && (
                    <tr>
                      <th>Classes</th>
                      <td>
                        <code>{elementClip.elementMeta.classNames.join(" ")}</code>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <th>URL</th>
                    <td>
                      <a href={elementClip.url} target="_blank" rel="noopener noreferrer">
                        {elementClip.url}
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <th>Saved</th>
                    <td>{new Date(elementClip.createdAt).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabs for content */}
            <div className="element-section">
              <div className="element-tabs">
                <button
                  className={`element-tab-btn ${activeTab === "text" ? "active" : ""}`}
                  onClick={() => setActiveTab("text")}
                >
                  Text Content
                </button>
                <button
                  className={`element-tab-btn ${activeTab === "markdown" ? "active" : ""}`}
                  onClick={() => setActiveTab("markdown")}
                >
                  Markdown
                </button>
                <button
                  className={`element-tab-btn ${activeTab === "html" ? "active" : ""}`}
                  onClick={() => setActiveTab("html")}
                >
                  HTML
                </button>
                <button
                  className={`element-tab-btn ${activeTab === "css" ? "active" : ""}`}
                  onClick={() => setActiveTab("css")}
                >
                  CSS
                </button>
              </div>

              <div className="element-tab-content">
                {activeTab === "text" && (
                  <pre className="element-code">{elementClip.textContent || "(empty)"}</pre>
                )}
                {activeTab === "markdown" && (
                  <pre className="element-code">{elementClip.markdownContent || "(empty)"}</pre>
                )}
                {activeTab === "html" && (
                  <pre className="element-code">{elementClip.domStructure}</pre>
                )}
                {activeTab === "css" && (
                  <pre className="element-code">{elementClip.scopedStyles}</pre>
                )}
              </div>
            </div>

            {/* Live Preview Section */}
            {/* <div className="element-preview-section">
              <h2>Live Preview</h2>
              <iframe
                title="Element preview"
                sandbox="allow-same-origin"
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <style>${elementClip.scopedStyles}</style>
                    </head>
                    <body>${elementClip.domStructure}</body>
                  </html>
                `}
                className="element-preview-iframe"
              />
            </div> */}
          </div>
        )}

        {/* Local Clip Rendering */}
        {!isElementClip && (
          <div
            ref={contentRef}
            className={`viewer-content ${isEditMode ? "outline-dashed outline-2 outline-border outline-offset-4" : ""}`}
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
