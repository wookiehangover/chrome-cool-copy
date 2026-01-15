import { useRef, useEffect } from "react";
import type { SharedClip } from "~/lib/agentdb.server";
import type { Highlight } from "@repo/shared";

interface ShareViewerProps {
  clip: SharedClip;
}

export function ShareViewer({ clip }: ShareViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Restore a single highlight to the DOM by walking text nodes
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
          mark.dataset.note = highlight.note;
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
  }, [clip]);

  // Apply highlights to DOM after content is rendered
  useEffect(() => {
    if (!contentRef.current) return;

    // Parse highlights from JSON string
    let highlights: Highlight[] = [];
    if (clip.highlights) {
      try {
        highlights = JSON.parse(clip.highlights);
      } catch (error) {
        console.warn("Failed to parse highlights:", error);
        return;
      }
    }

    if (highlights.length === 0) return;

    // Use requestAnimationFrame to ensure DOM is updated after dangerouslySetInnerHTML
    const rafId = requestAnimationFrame(() => {
      if (!contentRef.current) return;

      // Sort by offset descending to avoid messing up positions
      const sorted = [...highlights].sort((a, b) => b.startOffset - a.startOffset);
      for (const hl of sorted) {
        try {
          restoreHighlight(hl);
        } catch (error) {
          console.warn("Could not restore highlight:", hl.text.slice(0, 30));
        }
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [clip]);

  return (
    <div className="viewer-wrapper" ref={wrapperRef}>
      <div className="viewer-progress-bar" ref={progressBarRef} />

      <div className="viewer-container">
        {/* Header */}
        <header className="viewer-header">
          <h1 className="viewer-title">{clip.title}</h1>
          <div className="viewer-meta">
            <a href={clip.url} target="_blank" rel="noopener noreferrer" className="viewer-url">
              {new URL(clip.url).hostname}
            </a>
            <span className="viewer-meta-separator">•</span>
            <time>{new Date(clip.captured_at).toLocaleDateString()}</time>
          </div>
        </header>

        {/* Content */}
        <div
          ref={contentRef}
          className="viewer-content"
          dangerouslySetInnerHTML={{ __html: clip.dom_content }}
        />
      </div>
    </div>
  );
}
