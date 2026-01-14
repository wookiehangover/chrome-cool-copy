import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useClips } from "@/hooks/useClips";
import { useHighlights, useHighlightSync } from "@/hooks/useHighlights";
import type { LocalClip, ElementClip, Clip, Highlight } from "@repo/shared";
import { ViewerToolbar } from "./ViewerToolbar";
import { SettingsPanel } from "./SettingsPanel";
import { HighlightPopover } from "./HighlightPopover";

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
  const [activePopover, setActivePopover] = useState<{
    highlightId: string;
    position: { top: number; left: number };
  } | null>(null);
  const [selectionButton, setSelectionButton] = useState<{
    position: { top: number; left: number };
  } | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

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
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
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

  // Restore highlights in DOM when content or highlights change
  useEffect(() => {
    if (!contentRef.current || isEditMode) return;

    // Clear existing marks
    contentRef.current.querySelectorAll(".viewer-highlight").forEach((mark) => {
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
  }, [highlights, isEditMode]);

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

  const handleContentMouseUp = () => {
    if (isEditMode) {
      setSelectionButton(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) {
      setSelectionButton(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const contentRect = contentRef.current?.getBoundingClientRect();

    if (contentRect) {
      setSelectionButton({
        position: {
          top: rect.bottom - contentRect.top + 8,
          left: rect.left - contentRect.left + rect.width / 2 - 40,
        },
      });
    }
  };

  const handleHighlightClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest(".viewer-highlight") as HTMLElement;
    if (!mark) return;

    const highlightId = mark.dataset.highlightId;
    if (!highlightId) return;

    e.stopPropagation();

    const rect = mark.getBoundingClientRect();
    const contentRect = contentRef.current?.getBoundingClientRect();

    if (contentRect) {
      setActivePopover({
        highlightId,
        position: {
          top: rect.bottom - contentRect.top + 8,
          left: rect.left - contentRect.left,
        },
      });
    }
  };

  const handleCreateHighlight = async () => {
    if (!clip) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) return;

    const text = selection.toString();
    const range = selection.getRangeAt(0);
    const container = contentRef.current;

    if (!container) return;

    // Calculate absolute offsets from the clip's text_content
    const startOffset = getTextOffset(container, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(container, range.endContainer, range.endOffset);

    try {
      await addHighlight(clip.id, {
        text,
        startOffset,
        endOffset,
        color: "yellow",
      });

      const newHighlight: Highlight = {
        id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text,
        startOffset,
        endOffset,
        color: "yellow",
        created_at: new Date().toISOString(),
      };

      setHighlights([...highlights, newHighlight]);
      selection.removeAllRanges();
      setSelectionButton(null);
    } catch (error) {
      console.error("Failed to create highlight:", error);
    }
  };

  const handleSaveNote = async (note: string) => {
    if (!clip || !activePopover) return;

    try {
      await updateNote(clip.id, activePopover.highlightId, note);
      setHighlights(
        highlights.map((h) => (h.id === activePopover.highlightId ? { ...h, note } : h)),
      );
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  };

  const handleDeleteHighlight = async () => {
    if (!clip || !activePopover) return;

    try {
      await deleteHighlight(clip.id, activePopover.highlightId);
      setHighlights(highlights.filter((h) => h.id !== activePopover.highlightId));
    } catch (error) {
      console.error("Failed to delete highlight:", error);
    }
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
                isElementClip && elementClip ? elementClip.createdAt : (clip as LocalClip).created_at,
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
          <>
            <div
              ref={contentRef}
              className={`viewer-content ${isEditMode ? "outline-dashed outline-2 outline-border outline-offset-4" : ""}`}
              contentEditable={isEditMode}
              suppressContentEditableWarning
              onInput={(e) => setEditContent(e.currentTarget.innerHTML)}
              onMouseUp={handleContentMouseUp}
              onClick={handleHighlightClick}
              dangerouslySetInnerHTML={!isEditMode ? { __html: editContent } : undefined}
            />

            {/* Selection highlight button */}
            {selectionButton && !isEditMode && (
              <button
                className="highlight-selection-btn"
                style={{
                  position: "absolute",
                  top: `${selectionButton.position.top}px`,
                  left: `${selectionButton.position.left}px`,
                }}
                onClick={handleCreateHighlight}
              >
                Highlight
              </button>
            )}

            {/* Highlight popover */}
            {activePopover && (
              <HighlightPopover
                highlightId={activePopover.highlightId}
                initialNote={highlights.find((h) => h.id === activePopover.highlightId)?.note || ""}
                onSave={handleSaveNote}
                onDelete={handleDeleteHighlight}
                onClose={() => setActivePopover(null)}
                position={activePopover.position}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
