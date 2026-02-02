/**
 * Local Clips Storage Service Tests
 * Tests for CRUD operations on local clips
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getLocalClips,
  getLocalClip,
  saveLocalClip,
  updateClipSyncStatus,
  deleteLocalClip,
  getPendingClips,
  markAsLocalOnly,
  addHighlight,
  updateHighlightNote,
  deleteHighlight,
  isUrlClipped,
  updateLocalClip,
  type LocalClip,
  type ClipInput,
} from "./local-clips.js";
import { resetChromeMocks, mockStorage } from "../test/setup.js";

describe("Local Clips Storage Service", () => {
  beforeEach(() => {
    resetChromeMocks();
    // Mock chrome.storage.local to store data in memory
    const storage: Record<string, LocalClip[]> = {};

    mockStorage.local.get.mockImplementation((keys: string[]) => {
      const result: Record<string, LocalClip[]> = {};
      keys.forEach((key) => {
        if (storage[key]) {
          result[key] = storage[key];
        }
      });
      return Promise.resolve(result);
    });

    mockStorage.local.set.mockImplementation((data: Record<string, LocalClip[]>) => {
      Object.assign(storage, data);
      return Promise.resolve();
    });
  });

  const createTestClipInput = (overrides: Partial<ClipInput> = {}): ClipInput => ({
    url: "https://example.com/test",
    title: "Test Page",
    dom_content: "<html><body>Test content</body></html>",
    text_content: "Test content",
    metadata: { author: "Test Author" },
    ...overrides,
  });

  describe("getLocalClips()", () => {
    it("should return empty array when no clips exist", async () => {
      const clips = await getLocalClips();
      expect(clips).toEqual([]);
    });

    it("should return all clips sorted by created_at descending (newest first)", async () => {
      const clip1 = await saveLocalClip(createTestClipInput({ title: "Clip 1" }));

      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const clip2 = await saveLocalClip(createTestClipInput({ title: "Clip 2" }));

      const clips = await getLocalClips();
      expect(clips).toHaveLength(2);
      expect(clips[0].id).toBe(clip2.id);
      expect(clips[1].id).toBe(clip1.id);
    });
  });

  describe("getLocalClip()", () => {
    it("should return null for non-existent clip", async () => {
      const clip = await getLocalClip("non-existent");
      expect(clip).toBeNull();
    });

    it("should return clip by id", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      const clip = await getLocalClip(saved.id);
      expect(clip).toEqual(saved);
    });
  });

  describe("saveLocalClip()", () => {
    it("should create a new clip with generated id and timestamps", async () => {
      const clip = await saveLocalClip(createTestClipInput());

      expect(clip.id).toBeDefined();
      expect(clip.id).toMatch(/^clip_/);
      expect(clip.created_at).toBeDefined();
      expect(clip.updated_at).toBeDefined();
      expect(clip.sync_status).toBe("pending");
    });

    it("should store all input fields correctly", async () => {
      const input = createTestClipInput();
      const clip = await saveLocalClip(input);

      expect(clip.url).toBe(input.url);
      expect(clip.title).toBe(input.title);
      expect(clip.dom_content).toBe(input.dom_content);
      expect(clip.text_content).toBe(input.text_content);
      expect(clip.metadata).toEqual(input.metadata);
    });
  });

  describe("updateClipSyncStatus()", () => {
    it("should update sync status of existing clip", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      await updateClipSyncStatus(saved.id, "synced");

      const updated = await getLocalClip(saved.id);
      expect(updated?.sync_status).toBe("synced");
    });

    it("should set agentdb_id when provided", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      await updateClipSyncStatus(saved.id, "synced", "agentdb-123");

      const updated = await getLocalClip(saved.id);
      expect(updated?.agentdb_id).toBe("agentdb-123");
    });

    it("should set sync_error when provided", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      await updateClipSyncStatus(saved.id, "error", undefined, "Sync failed");

      const updated = await getLocalClip(saved.id);
      expect(updated?.sync_status).toBe("error");
      expect(updated?.sync_error).toBe("Sync failed");
    });

    it("should handle non-existent clip gracefully", async () => {
      // Should not throw
      await updateClipSyncStatus("non-existent", "synced");
    });
  });

  describe("deleteLocalClip()", () => {
    it("should delete clip and return true", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      const result = await deleteLocalClip(saved.id);
      expect(result).toBe(true);

      const clip = await getLocalClip(saved.id);
      expect(clip).toBeNull();
    });

    it("should return false for non-existent clip", async () => {
      const result = await deleteLocalClip("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("getPendingClips()", () => {
    it("should return only clips with pending sync status", async () => {
      const clip1 = await saveLocalClip(createTestClipInput({ title: "Pending 1" }));
      const clip2 = await saveLocalClip(createTestClipInput({ title: "Pending 2" }));
      await updateClipSyncStatus(clip2.id, "synced");

      const pending = await getPendingClips();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(clip1.id);
    });
  });

  describe("markAsLocalOnly()", () => {
    it("should set sync status to local-only", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      await markAsLocalOnly(saved.id);

      const updated = await getLocalClip(saved.id);
      expect(updated?.sync_status).toBe("local-only");
    });
  });

  describe("addHighlight()", () => {
    it("should add highlight to existing clip", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      const highlight = await addHighlight(saved.id, {
        text: "highlighted text",
        startOffset: 0,
        endOffset: 15,
        color: "yellow",
      });

      expect(highlight).not.toBeNull();
      expect(highlight?.id).toMatch(/^hl_/);
      expect(highlight?.text).toBe("highlighted text");
      expect(highlight?.created_at).toBeDefined();

      const updated = await getLocalClip(saved.id);
      expect(updated?.highlights).toHaveLength(1);
    });

    it("should return null for non-existent clip", async () => {
      const highlight = await addHighlight("non-existent", {
        text: "test",
        startOffset: 0,
        endOffset: 4,
        color: "yellow",
      });

      expect(highlight).toBeNull();
    });
  });

  describe("updateHighlightNote()", () => {
    it("should update note on existing highlight", async () => {
      const saved = await saveLocalClip(createTestClipInput());
      const highlight = await addHighlight(saved.id, {
        text: "test",
        startOffset: 0,
        endOffset: 4,
        color: "yellow",
      });

      const result = await updateHighlightNote(saved.id, highlight!.id, "My note");
      expect(result).toBe(true);

      const updated = await getLocalClip(saved.id);
      expect(updated?.highlights?.[0].note).toBe("My note");
    });

    it("should return false for non-existent clip", async () => {
      const result = await updateHighlightNote("non-existent", "hl_123", "note");
      expect(result).toBe(false);
    });

    it("should return false for non-existent highlight", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      const result = await updateHighlightNote(saved.id, "non-existent", "note");
      expect(result).toBe(false);
    });
  });

  describe("deleteHighlight()", () => {
    it("should delete highlight from clip", async () => {
      const saved = await saveLocalClip(createTestClipInput());
      const highlight = await addHighlight(saved.id, {
        text: "test",
        startOffset: 0,
        endOffset: 4,
        color: "yellow",
      });

      const result = await deleteHighlight(saved.id, highlight!.id);
      expect(result).toBe(true);

      const updated = await getLocalClip(saved.id);
      expect(updated?.highlights).toHaveLength(0);
    });

    it("should return false for non-existent clip", async () => {
      const result = await deleteHighlight("non-existent", "hl_123");
      expect(result).toBe(false);
    });

    it("should return false for non-existent highlight", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      const result = await deleteHighlight(saved.id, "non-existent");
      expect(result).toBe(false);
    });
  });

  describe("isUrlClipped()", () => {
    it("should return clip if URL already clipped", async () => {
      const input = createTestClipInput({ url: "https://example.com/unique" });
      const saved = await saveLocalClip(input);

      const found = await isUrlClipped("https://example.com/unique");
      expect(found).toEqual(saved);
    });

    it("should return null if URL not clipped", async () => {
      const found = await isUrlClipped("https://example.com/not-clipped");
      expect(found).toBeNull();
    });
  });

  describe("updateLocalClip()", () => {
    it("should update clip with provided fields", async () => {
      const saved = await saveLocalClip(createTestClipInput());

      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await updateLocalClip(saved.id, { title: "Updated Title" });
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.updated_at).not.toBe(saved.updated_at);
    });

    it("should return null for non-existent clip", async () => {
      const result = await updateLocalClip("non-existent", { title: "Test" });
      expect(result).toBeNull();
    });
  });
});

