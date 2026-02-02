/**
 * ID Utilities Tests
 * Tests for unique identifier generation functions
 */

import { describe, it, expect } from "vitest";
import { generateUUID, generateSessionId, generateClipId, generateId } from "./id.js";

// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
// where y is 8, 9, a, or b
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("ID Utilities", () => {
  describe("generateUUID()", () => {
    it("should return a valid UUID v4 format", () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(UUID_REGEX);
    });

    it("should generate unique UUIDs across multiple calls", () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(100);
    });

    it("should return a string of 36 characters", () => {
      const uuid = generateUUID();
      expect(uuid.length).toBe(36);
    });
  });

  describe("generateSessionId()", () => {
    it("should return a valid UUID v4 format", () => {
      const sessionId = generateSessionId();
      expect(sessionId).toMatch(UUID_REGEX);
    });

    it("should generate unique session IDs across multiple calls", () => {
      const sessionIds = new Set<string>();
      for (let i = 0; i < 100; i++) {
        sessionIds.add(generateSessionId());
      }
      expect(sessionIds.size).toBe(100);
    });
  });

  describe("generateClipId()", () => {
    // Format: clip_{timestamp}_{randomSuffix}
    const CLIP_ID_REGEX = /^clip_\d+_[a-z0-9]+$/;

    it("should return a clip ID with correct format", () => {
      const clipId = generateClipId();
      expect(clipId).toMatch(CLIP_ID_REGEX);
    });

    it("should start with clip_ prefix", () => {
      const clipId = generateClipId();
      expect(clipId.startsWith("clip_")).toBe(true);
    });

    it("should include a timestamp component", () => {
      const beforeTime = Date.now();
      const clipId = generateClipId();
      const afterTime = Date.now();

      const parts = clipId.split("_");
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should include a random suffix", () => {
      const clipId = generateClipId();
      const parts = clipId.split("_");
      const suffix = parts[2];

      // Random suffix should be non-empty alphanumeric
      expect(suffix.length).toBeGreaterThan(0);
      expect(suffix).toMatch(/^[a-z0-9]+$/);
    });

    it("should generate unique clip IDs across multiple calls", () => {
      const clipIds = new Set<string>();
      for (let i = 0; i < 100; i++) {
        clipIds.add(generateClipId());
      }
      expect(clipIds.size).toBe(100);
    });
  });

  describe("generateId()", () => {
    // Format without prefix: {timestamp}_{randomSuffix}
    const ID_NO_PREFIX_REGEX = /^\d+_[a-z0-9]+$/;

    it("should return an ID without prefix when no prefix provided", () => {
      const id = generateId();
      expect(id).toMatch(ID_NO_PREFIX_REGEX);
    });

    it("should return an ID without prefix when prefix is undefined", () => {
      const id = generateId(undefined);
      expect(id).toMatch(ID_NO_PREFIX_REGEX);
    });

    it("should prepend prefix when provided", () => {
      const id = generateId("test");
      expect(id.startsWith("test_")).toBe(true);
    });

    it("should handle various prefix values", () => {
      const prefixes = ["user", "session", "item", "myPrefix123"];
      for (const prefix of prefixes) {
        const id = generateId(prefix);
        expect(id.startsWith(`${prefix}_`)).toBe(true);
      }
    });

    it("should include timestamp and random suffix after prefix", () => {
      const beforeTime = Date.now();
      const id = generateId("test");
      const afterTime = Date.now();

      // Format: test_{timestamp}_{random}
      const parts = id.split("_");
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe("test");

      const timestamp = parseInt(parts[1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);

      expect(parts[2]).toMatch(/^[a-z0-9]+$/);
    });

    it("should generate unique IDs across multiple calls", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId("prefix"));
      }
      expect(ids.size).toBe(100);
    });

    it("should generate unique IDs without prefix across multiple calls", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });
});

