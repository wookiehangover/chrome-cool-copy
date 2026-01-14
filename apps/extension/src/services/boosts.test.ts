/**
 * Boost Storage Service Tests
 * Tests for CRUD operations and domain matching
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getBoosts,
  getBoost,
  getBoostsForDomain,
  saveBoost,
  updateBoost,
  deleteBoost,
  toggleBoost,
  matchesDomain,
  type Boost,
} from "./boosts.js";
import { resetChromeMocks, mockStorage } from "../test/setup.js";

describe("Boost Storage Service", () => {
  beforeEach(() => {
    resetChromeMocks();
    // Mock chrome.storage.local to store data in memory
    const storage: Record<string, Boost[]> = {};

    mockStorage.local.get.mockImplementation((keys: string[]) => {
      const result: Record<string, Boost[]> = {};
      keys.forEach((key) => {
        if (storage[key]) {
          result[key] = storage[key];
        }
      });
      return Promise.resolve(result);
    });

    mockStorage.local.set.mockImplementation((data: Record<string, Boost[]>) => {
      Object.assign(storage, data);
      return Promise.resolve();
    });
  });

  describe("getBoosts()", () => {
    it("should return empty array when no boosts exist", async () => {
      const boosts = await getBoosts();
      expect(boosts).toEqual([]);
    });

    it("should return all boosts sorted by createdAt descending", async () => {
      const boost1 = await saveBoost({
        name: "Boost 1",
        description: "First boost",
        domain: "github.com",
        code: "console.log('1')",
        enabled: true,
        runMode: "auto",
      });

      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const boost2 = await saveBoost({
        name: "Boost 2",
        description: "Second boost",
        domain: "github.com",
        code: "console.log('2')",
        enabled: true,
        runMode: "auto",
      });

      const boosts = await getBoosts();
      expect(boosts).toHaveLength(2);
      expect(boosts[0].id).toBe(boost2.id);
      expect(boosts[1].id).toBe(boost1.id);
    });
  });

  describe("getBoost()", () => {
    it("should return null for non-existent boost", async () => {
      const boost = await getBoost("non-existent");
      expect(boost).toBeNull();
    });

    it("should return boost by id", async () => {
      const saved = await saveBoost({
        name: "Test Boost",
        description: "Test",
        domain: "github.com",
        code: "console.log('test')",
        enabled: true,
        runMode: "auto",
      });

      const boost = await getBoost(saved.id);
      expect(boost).toEqual(saved);
    });
  });

  describe("getBoostsForDomain()", () => {
    it("should return only enabled boosts matching domain", async () => {
      await saveBoost({
        name: "GitHub Boost",
        description: "Test",
        domain: "github.com",
        code: "console.log('github')",
        enabled: true,
        runMode: "auto",
      });

      await saveBoost({
        name: "Disabled Boost",
        description: "Test",
        domain: "github.com",
        code: "console.log('disabled')",
        enabled: false,
        runMode: "auto",
      });

      await saveBoost({
        name: "Other Domain",
        description: "Test",
        domain: "example.com",
        code: "console.log('other')",
        enabled: true,
        runMode: "auto",
      });

      const boosts = await getBoostsForDomain("github.com");
      expect(boosts).toHaveLength(1);
      expect(boosts[0].name).toBe("GitHub Boost");
    });
  });

  describe("saveBoost()", () => {
    it("should create a new boost with generated id and timestamps", async () => {
      const boost = await saveBoost({
        name: "New Boost",
        description: "Test boost",
        domain: "github.com",
        code: "console.log('test')",
        enabled: true,
        runMode: "auto",
      });

      expect(boost.id).toBeDefined();
      expect(boost.id).toMatch(/^boost_/);
      expect(boost.createdAt).toBeDefined();
      expect(boost.updatedAt).toBeDefined();
      expect(boost.name).toBe("New Boost");
    });
  });

  describe("updateBoost()", () => {
    it("should update boost and set updatedAt", async () => {
      const saved = await saveBoost({
        name: "Original",
        description: "Test",
        domain: "github.com",
        code: "console.log('original')",
        enabled: true,
        runMode: "auto",
      });

      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await updateBoost(saved.id, { name: "Updated" });
      expect(updated?.name).toBe("Updated");
      expect(updated?.updatedAt).not.toBe(saved.updatedAt);
    });

    it("should return null for non-existent boost", async () => {
      const result = await updateBoost("non-existent", { name: "Updated" });
      expect(result).toBeNull();
    });
  });

  describe("deleteBoost()", () => {
    it("should delete boost and return true", async () => {
      const saved = await saveBoost({
        name: "To Delete",
        description: "Test",
        domain: "github.com",
        code: "console.log('delete')",
        enabled: true,
        runMode: "auto",
      });

      const result = await deleteBoost(saved.id);
      expect(result).toBe(true);

      const boost = await getBoost(saved.id);
      expect(boost).toBeNull();
    });

    it("should return false for non-existent boost", async () => {
      const result = await deleteBoost("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("toggleBoost()", () => {
    it("should toggle enabled state", async () => {
      const saved = await saveBoost({
        name: "Toggle Test",
        description: "Test",
        domain: "github.com",
        code: "console.log('toggle')",
        enabled: true,
        runMode: "auto",
      });

      const toggled = await toggleBoost(saved.id);
      expect(toggled?.enabled).toBe(false);

      const toggled2 = await toggleBoost(saved.id);
      expect(toggled2?.enabled).toBe(true);
    });

    it("should return null for non-existent boost", async () => {
      const result = await toggleBoost("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("matchesDomain()", () => {
    it("should match wildcard pattern", () => {
      expect(matchesDomain("*", "github.com")).toBe(true);
      expect(matchesDomain("*", "example.com")).toBe(true);
      expect(matchesDomain("*", "any.domain.com")).toBe(true);
    });

    it("should match exact domain", () => {
      expect(matchesDomain("github.com", "github.com")).toBe(true);
      expect(matchesDomain("github.com", "gist.github.com")).toBe(false);
    });

    it("should match subdomain pattern", () => {
      expect(matchesDomain("*.github.com", "github.com")).toBe(true);
      expect(matchesDomain("*.github.com", "gist.github.com")).toBe(true);
      expect(matchesDomain("*.github.com", "api.github.com")).toBe(true);
      expect(matchesDomain("*.github.com", "example.com")).toBe(false);
    });
  });
});
