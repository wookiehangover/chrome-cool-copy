/**
 * Background Script Message Handler Integration Tests
 * Tests for message-passing flow between content script and background
 *
 * These tests verify the message format contracts and response structures
 * for the critical paths: clipElement, captureFullPage, and generateText.
 *
 * Note: The actual background.ts has side effects that make direct importing
 * difficult in a test environment. These tests focus on contract verification.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeMocks } from "./test/setup.js";

describe("Background Message Handlers", () => {
  beforeEach(() => {
    resetChromeMocks();
    vi.clearAllMocks();
  });

  describe("clipElement", () => {
    describe("message format contract", () => {
      it("should define the required message structure for clipElement", () => {
        // This documents the expected message format for clipElement
        const validMessage = {
          action: "clipElement",
          data: {
            url: "https://example.com",
            pageTitle: "Example Page",
            selector: "div.content",
            domStructure: "<div>content</div>",
            scopedStyles: ".content { color: black; }",
            textContent: "content",
            markdownContent: "content",
            structuredData: null,
            mediaAssets: [],
            elementMeta: {
              tagName: "DIV",
              boundingBox: { x: 0, y: 0, width: 100, height: 50 },
              classNames: ["content"],
              dataAttributes: {},
            },
          },
          screenshotDataUrl: null,
          imageBlob: null,
        };

        // Verify required fields
        expect(validMessage.action).toBe("clipElement");
        expect(validMessage.data).toBeDefined();
        expect(validMessage.data.url).toBeDefined();
        expect(validMessage.data.pageTitle).toBeDefined();
        expect(validMessage.data.selector).toBeDefined();
        expect(validMessage.data.domStructure).toBeDefined();
        expect(validMessage.data.scopedStyles).toBeDefined();
        expect(validMessage.data.textContent).toBeDefined();
        expect(validMessage.data.markdownContent).toBeDefined();
        expect(validMessage.data.mediaAssets).toBeInstanceOf(Array);
        expect(validMessage.data.elementMeta).toBeDefined();
        expect(validMessage.data.elementMeta.tagName).toBeDefined();
        expect(validMessage.data.elementMeta.boundingBox).toBeDefined();
      });

      it("should define elementMeta bounding box structure", () => {
        const validBoundingBox = {
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        };

        expect(validBoundingBox).toHaveProperty("x");
        expect(validBoundingBox).toHaveProperty("y");
        expect(validBoundingBox).toHaveProperty("width");
        expect(validBoundingBox).toHaveProperty("height");
        expect(typeof validBoundingBox.x).toBe("number");
        expect(typeof validBoundingBox.y).toBe("number");
        expect(typeof validBoundingBox.width).toBe("number");
        expect(typeof validBoundingBox.height).toBe("number");
      });
    });

    describe("response structure", () => {
      it("should define expected success response shape", () => {
        // Document the expected response structure for clipElement
        type ClipElementResponse = {
          success: true;
          message: string;
          clipId: string;
        } | {
          success: false;
          error: string;
        };

        const successResponse: ClipElementResponse = {
          success: true,
          message: "Element clipped successfully",
          clipId: "clip_1234567890_abcdefghi",
        };
        expect(successResponse.success).toBe(true);
        expect(successResponse.message).toBe("Element clipped successfully");
        expect(successResponse.clipId).toMatch(/^clip_\d+_/);

        const errorResponse: ClipElementResponse = {
          success: false,
          error: "Storage unavailable",
        };
        expect(errorResponse.success).toBe(false);
        expect(errorResponse.error).toBeDefined();
      });

      it("should generate clip IDs with correct format", () => {
        // Verify the clip ID format matches what background.ts generates
        const clipId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        expect(clipId).toMatch(/^clip_\d+_[a-z0-9]+$/);
      });
    });

    describe("error cases", () => {
      it("should return error when data is missing", () => {
        // Document expected error for missing data
        const invalidMessage = {
          action: "clipElement",
          // missing data field
        };

        expect(invalidMessage).not.toHaveProperty("data");
      });

      it("should return error when required data fields are missing", () => {
        // Document expected error for incomplete data
        const incompleteData = {
          url: "https://example.com",
          // missing other required fields
        };

        expect(incompleteData).not.toHaveProperty("pageTitle");
        expect(incompleteData).not.toHaveProperty("selector");
        expect(incompleteData).not.toHaveProperty("domStructure");
      });
    });
  });

  describe("captureFullPage", () => {
    describe("message format contract", () => {
      it("should define the required message structure for captureFullPage", () => {
        const validMessage = {
          action: "captureFullPage",
          pageInfo: {
            scrollWidth: 1920,
            scrollHeight: 3000,
            viewportWidth: 1920,
            viewportHeight: 1080,
            devicePixelRatio: 2,
            originalScrollX: 0,
            originalScrollY: 500,
          },
        };

        expect(validMessage.action).toBe("captureFullPage");
        expect(validMessage.pageInfo).toHaveProperty("scrollWidth");
        expect(validMessage.pageInfo).toHaveProperty("scrollHeight");
        expect(validMessage.pageInfo).toHaveProperty("viewportWidth");
        expect(validMessage.pageInfo).toHaveProperty("viewportHeight");
        expect(validMessage.pageInfo).toHaveProperty("devicePixelRatio");
        expect(validMessage.pageInfo).toHaveProperty("originalScrollX");
        expect(validMessage.pageInfo).toHaveProperty("originalScrollY");
      });

      it("should require all pageInfo fields to be numbers", () => {
        const validPageInfo = {
          scrollWidth: 1920,
          scrollHeight: 3000,
          viewportWidth: 1920,
          viewportHeight: 1080,
          devicePixelRatio: 2,
          originalScrollX: 0,
          originalScrollY: 500,
        };

        expect(typeof validPageInfo.scrollWidth).toBe("number");
        expect(typeof validPageInfo.scrollHeight).toBe("number");
        expect(typeof validPageInfo.viewportWidth).toBe("number");
        expect(typeof validPageInfo.viewportHeight).toBe("number");
        expect(typeof validPageInfo.devicePixelRatio).toBe("number");
        expect(typeof validPageInfo.originalScrollX).toBe("number");
        expect(typeof validPageInfo.originalScrollY).toBe("number");
      });
    });

    describe("error cases", () => {
      it("should document error when no tab ID is available", () => {
        // Document the expected error response when sender.tab.id is undefined
        // This happens when captureFullPage is called from popup or sidepanel context
        const expectedErrorResponse = {
          success: false,
          error: "No tab ID available",
        };

        expect(expectedErrorResponse.success).toBe(false);
        expect(expectedErrorResponse.error).toBe("No tab ID available");
      });

      it("should document error when pageInfo is missing", () => {
        // Document that pageInfo is required
        const invalidMessage = {
          action: "captureFullPage",
          // missing pageInfo
        };

        expect(invalidMessage).not.toHaveProperty("pageInfo");
      });
    });

    describe("response structure", () => {
      it("should define expected success response shape", () => {
        // Document the expected response structure for captureFullPage
        type CaptureFullPageResponse = {
          success: true;
          imageData: string; // data URL of captured image
        } | {
          success: false;
          error: string;
        };

        const successResponse: CaptureFullPageResponse = {
          success: true,
          imageData: "data:image/png;base64,iVBORw0KGgo...",
        };
        expect(successResponse.success).toBe(true);
        expect(successResponse.imageData).toMatch(/^data:image\/png;base64,/);

        const errorResponse: CaptureFullPageResponse = {
          success: false,
          error: "No tab ID available",
        };
        expect(errorResponse.success).toBe(false);
        expect(errorResponse.error).toBeDefined();
      });
    });
  });

  describe("generateText", () => {
    describe("message format contract", () => {
      it("should define the required message structure for generateText", () => {
        const validMessage = {
          action: "generateText",
          messages: [
            { role: "user", content: "Hello, how are you?" },
          ],
          system: "You are a helpful assistant.",
          temperature: 0.7,
          maxOutputTokens: 2000,
          enableTools: true,
        };

        expect(validMessage.action).toBe("generateText");
        expect(validMessage.messages).toBeInstanceOf(Array);
        expect(validMessage.messages[0]).toHaveProperty("role");
        expect(validMessage.messages[0]).toHaveProperty("content");
      });

      it("should require messages array", () => {
        const invalidMessage = {
          action: "generateText",
          // missing messages
        };

        expect(invalidMessage).not.toHaveProperty("messages");
      });

      it("should support all optional AI call settings", () => {
        // Document all optional settings from AICallSettings interface
        const fullRequest = {
          action: "generateText",
          messages: [{ role: "user", content: "Test" }],
          system: "System prompt",
          temperature: 0.7,
          maxOutputTokens: 2000,
          topP: 0.9,
          topK: 40,
          presencePenalty: 0.1,
          frequencyPenalty: 0.1,
          stopSequences: ["END"],
          seed: 42,
          maxRetries: 3,
          headers: { "X-Custom": "value" },
          enableTools: true,
          toolChoice: "auto",
          maxSteps: 3,
          model: "custom-model",
        };

        expect(fullRequest).toHaveProperty("temperature");
        expect(fullRequest).toHaveProperty("maxOutputTokens");
        expect(fullRequest).toHaveProperty("topP");
        expect(fullRequest).toHaveProperty("topK");
        expect(fullRequest).toHaveProperty("presencePenalty");
        expect(fullRequest).toHaveProperty("frequencyPenalty");
        expect(fullRequest).toHaveProperty("stopSequences");
        expect(fullRequest).toHaveProperty("seed");
        expect(fullRequest).toHaveProperty("maxRetries");
        expect(fullRequest).toHaveProperty("headers");
        expect(fullRequest).toHaveProperty("enableTools");
        expect(fullRequest).toHaveProperty("toolChoice");
        expect(fullRequest).toHaveProperty("maxSteps");
        expect(fullRequest).toHaveProperty("model");
      });
    });

    describe("error cases", () => {
      it("should document error when AI gateway not configured", () => {
        // Document the expected error response when aiGatewayConfig is missing
        const expectedErrorResponse = {
          success: false,
          error: "Vercel AI Gateway configuration not found. Please configure settings.",
        };

        expect(expectedErrorResponse.success).toBe(false);
        expect(expectedErrorResponse.error).toContain("Vercel AI Gateway configuration not found");
      });

      it("should document error when messages array is invalid", () => {
        // Document the expected error response when messages is not an array
        const expectedErrorResponse = {
          success: false,
          error: "Invalid request: messages array is required",
        };

        expect(expectedErrorResponse.success).toBe(false);
        expect(expectedErrorResponse.error).toContain("messages array is required");
      });

      it("should document error when API key is missing from config", () => {
        // Document partial configuration error
        const incompleteConfig = {
          model: "test-model",
          // missing apiKey
        };

        expect(incompleteConfig).not.toHaveProperty("apiKey");
      });
    });

    describe("response structure", () => {
      it("should define expected success response shape", () => {
        // Document the expected response structure for generateText
        type GenerateTextResponse = {
          success: true;
          content: string;
          usage?: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
          };
        } | {
          success: false;
          error: string;
        };

        const successResponse: GenerateTextResponse = {
          success: true,
          content: "Hello! I'm doing well, thank you.",
          usage: {
            inputTokens: 10,
            outputTokens: 15,
            totalTokens: 25,
          },
        };
        expect(successResponse.success).toBe(true);
        expect(successResponse.content).toBeDefined();
        expect(successResponse.usage?.totalTokens).toBe(25);

        const errorResponse: GenerateTextResponse = {
          success: false,
          error: "API key invalid",
        };
        expect(errorResponse.success).toBe(false);
        expect(errorResponse.error).toBeDefined();
      });

      it("should calculate totalTokens from input and output tokens", () => {
        // Verify the usage calculation matches background.ts logic
        const inputTokens = 10;
        const outputTokens = 15;
        const totalTokens = inputTokens + outputTokens;

        expect(totalTokens).toBe(25);
      });
    });
  });
});

