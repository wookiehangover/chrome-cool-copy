import { describe, expect, it } from "vitest";
import { classifyHighlightClick } from "./ClipViewer";

describe("classifyHighlightClick", () => {
  it("classifies a content click outside a highlight for popover save and hide", () => {
    const content = document.createElement("p");
    expect(classifyHighlightClick(content)).toEqual({ kind: "outside" });
  });

  it("returns the containing highlight when a nested element is clicked", () => {
    const highlight = document.createElement("mark");
    highlight.className = "viewer-highlight";
    const child = document.createElement("span");
    highlight.append(child);

    expect(classifyHighlightClick(child)).toEqual({ kind: "highlight", element: highlight });
  });
});
