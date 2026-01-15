import { useRef, useEffect } from "react";
import type { SharedClip } from "@/lib/agentdb";

interface ShareViewerProps {
  clip: SharedClip;
}

export function ShareViewer({ clip }: ShareViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

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

