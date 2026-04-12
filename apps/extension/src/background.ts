// Background service worker for handling keyboard shortcuts

// Polyfill process.env for Vercel AI SDK (required in Chrome extension context)
declare const process: { env: Record<string, string | undefined> } | undefined;
if (typeof process === "undefined") {
  (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process = {
    env: {},
  };
}

import { streamText, createGateway, stepCountIs } from "ai";
import { tools } from "./tools/browse";
import { createBoostTools } from "./tools/boost-tools";
import { getBoostSystemPrompt } from "@repo/shared";
import type { StreamTextRequest, StreamMessageType } from "@repo/shared";
import {
  clipsHandlers,
  boostsHandlers,
  aiHandlers,
  mediaHandlers,
  initAssetStore,
  boostDrafts,
  getAIGateway,
} from "./handlers";
import type { HandlerMap } from "./handlers";

// =============================================================================
// Message Router
// =============================================================================

/**
 * Combined handler map from all domain-specific handler modules.
 */
const handlers: HandlerMap = {
  ...clipsHandlers,
  ...boostsHandlers,
  ...aiHandlers,
  ...mediaHandlers,
};

/**
 * Send a message to the content script with error handling
 */
function sendMessageToTab(tabId: number, message: { action: string }): void {
  chrome.tabs.sendMessage(tabId, message, (response: { success?: boolean } | undefined) => {
    if (chrome.runtime.lastError) {
      console.error("[Clean Link Copy] Failed to send message:", chrome.runtime.lastError.message);
      return;
    }
    if (response && response.success) {
      console.log("[Clean Link Copy] Message sent successfully:", message.action);
    }
  });
}

// Disable the side panel globally so it only appears on tabs that explicitly open it
chrome.sidePanel.setOptions({ enabled: false });

// =============================================================================
// Keyboard Shortcuts
// =============================================================================

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error("[Clean Link Copy] Failed to query tabs:", chrome.runtime.lastError.message);
      return;
    }

    if (tabs.length === 0) {
      console.warn("[Clean Link Copy] No active tab found");
      return;
    }

    const tab = tabs[0];
    if (tab.id === undefined) {
      console.warn("[Clean Link Copy] Tab ID is undefined");
      return;
    }
    const tabId = tab.id;

    if (command === "copy-clean-url") {
      sendMessageToTab(tabId, { action: "copyCleanUrl" });
    } else if (command === "copy-markdown-link") {
      sendMessageToTab(tabId, { action: "copyMarkdownLink" });
    } else if (command === "open-command-palette") {
      sendMessageToTab(tabId, { action: "openCommandPalette" });
    } else if (command === "reader-mode") {
      sendMessageToTab(tabId, { action: "toggleReaderMode" });
    } else if (command === "open-chat") {
      chrome.sidePanel.setOptions({ tabId, enabled: true, path: "sidepanel/index.html" });
      chrome.sidePanel.open({ tabId }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Side Panel] Error opening side panel:", chrome.runtime.lastError);
        } else {
          console.log("[Side Panel] Side panel opened via keyboard shortcut for tab", tabId);
        }
      });
    }
  });
});

// =============================================================================
// Grokipedia
// =============================================================================

async function checkGrokipediaExists(articleTitle: string): Promise<boolean> {
  const GROKIPEDIA_BASE_URL = "https://grokipedia.com/page";
  const encodedTitle = encodeURIComponent(articleTitle.trim());
  const url = `${GROKIPEDIA_BASE_URL}/${encodedTitle}`;

  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch (error) {
    console.error(`[Grokipedia] Error checking page for "${articleTitle}":`, error);
    return false;
  }
}

// =============================================================================
// Main Message Router
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Grokipedia handler (stays in background.ts)
    if (message.action === "checkGrokipediaExists") {
      checkGrokipediaExists(message.articleTitle)
        .then((exists) => {
          sendResponse({ success: true, exists });
        })
        .catch((error) => {
          console.error("[Grokipedia] Error in checkGrokipediaExists handler:", error);
          sendResponse({ success: false, exists: false, error: error.message });
        });
      return true;
    }

    // Read aloud / TTS handler (stays in background.ts)
    if (message.action === "readAloud") {
      (async () => {
        try {
          await chrome.storage.local.set({
            tts_pending_text: {
              text: message.text,
              title: message.title,
              url: message.url,
              timestamp: Date.now(),
            },
          });

          await chrome.windows.create({
            url: chrome.runtime.getURL("tts-player/index.html"),
            type: "popup",
            width: 350,
            height: 175,
          });

          sendResponse({ success: true });
        } catch (error) {
          console.error("[Read Aloud] Error:", error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true;
    }

    // Dispatch to domain-specific handler modules
    const handler = handlers[message.action as string];
    if (handler) {
      return handler(message, sender, sendResponse);
    }
  } catch (error: unknown) {
    console.error("[Clean Link Copy] Error in message listener:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// =============================================================================
// Side Panel
// =============================================================================

async function sendNavigationWithRetry(
  path: string,
  params?: Record<string, string>,
  maxRetries = 5,
  initialDelayMs = 100,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await new Promise<{ success?: boolean }>((resolve) => {
        chrome.runtime.sendMessage({ action: "navigate", path, params }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false });
          } else {
            resolve(resp || { success: false });
          }
        });
      });

      if (response?.success) {
        console.log(`[Side Panel] Navigation succeeded on attempt ${attempt + 1}`);
        return true;
      }
    } catch {
      // Continue to retry
    }

    const delay = initialDelayMs * Math.pow(2, attempt);
    console.log(`[Side Panel] Navigation attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.error("[Side Panel] Navigation failed after all retries");
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openSidePanel") {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      chrome.sidePanel.setOptions({ tabId, enabled: true, path: "sidepanel/index.html" });
      chrome.sidePanel.open({ tabId }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Side Panel] Error opening side panel:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log("[Side Panel] Side panel opened for tab", tabId);
          sendResponse({ success: true });
        }
      });
      return true;
    }
  } else if (message.action === "openSidePanelTo") {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      chrome.sidePanel.setOptions({ tabId, enabled: true, path: "sidepanel/index.html" });
      chrome.sidePanel.open({ tabId }, async () => {
        if (chrome.runtime.lastError) {
          console.error("[Side Panel] Error opening side panel:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log(
            "[Side Panel] Side panel opened for tab",
            tabId,
            "navigating to",
            message.path,
          );
          const success = await sendNavigationWithRetry(message.path, message.params);
          sendResponse({ success });
        }
      });
      return true;
    }
  } else if (message.action === "openSidePanelFromPopup") {
    const tabId = message.tabId;
    if (tabId !== undefined) {
      chrome.sidePanel.setOptions({ tabId, enabled: true, path: "sidepanel/index.html" });
      chrome.sidePanel.open({ tabId }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Side Panel] Error opening side panel:", chrome.runtime.lastError);
        } else {
          console.log("[Side Panel] Side panel opened from popup for tab", tabId);
        }
      });
    }
  }
});

// =============================================================================
// Tab Lifecycle
// =============================================================================

chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log("[Side Panel] Tab activated:", activeInfo.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  console.log("[Side Panel] Tab removed:", tabId);
  boostDrafts.delete(tabId);
  console.log("[Boosts] Cleaned up draft for closed tab", tabId);
});

// =============================================================================
// Streaming AI (port-based)
// =============================================================================

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "aiStream") return;

  port.onMessage.addListener(async (message) => {
    if (message.action !== "streamText") return;

    const request = message as StreamTextRequest;
    const sendMessage = (msg: StreamMessageType) => port.postMessage(msg);

    try {
      const { gateway, config } = await getAIGateway();

      if (!request.messages || !Array.isArray(request.messages)) {
        sendMessage({ type: "error", error: "Invalid request: messages array is required" });
        return;
      }

      console.log("[Vercel AI Gateway] Starting streaming request for model:", config.model);

      const enableTools = request.enableTools !== false;
      const modelToUse = request.model || config.model;

      const defaultProviderOptions = {
        anthropic: {
          thinking: { type: "enabled" as const, budgetTokens: 10000 },
        },
      };

      const result = streamText({
        model: gateway(modelToUse),
        messages: request.messages,
        ...(request.system && { system: request.system }),
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        topP: request.topP,
        topK: request.topK,
        presencePenalty: request.presencePenalty,
        frequencyPenalty: request.frequencyPenalty,
        stopSequences: request.stopSequences,
        seed: request.seed,
        maxRetries: request.maxRetries,
        headers: request.headers,
        stopWhen: stepCountIs(request.maxSteps ?? 5),
        ...(enableTools && {
          tools,
          toolChoice: request.toolChoice ?? "auto",
        }),
        providerOptions: {
          ...defaultProviderOptions,
          ...request.providerOptions,
        },
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "reasoning-start":
            sendMessage({ type: "reasoning-start" });
            break;
          case "reasoning-delta":
            sendMessage({ type: "reasoning", content: part.text });
            break;
          case "reasoning-end":
            sendMessage({ type: "reasoning-end" });
            break;
          case "tool-input-start":
            sendMessage({ type: "tool-input-start", toolCallId: part.id, toolName: part.toolName });
            break;
          case "tool-input-delta":
            sendMessage({
              type: "tool-input-delta",
              toolCallId: part.id,
              inputTextDelta: part.delta,
            });
            break;
          case "tool-call":
            sendMessage({
              type: "tool-call",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            });
            break;
          case "tool-result":
            sendMessage({
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            });
            break;
          case "tool-error":
            sendMessage({
              type: "tool-error",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              errorText: part.error instanceof Error ? part.error.message : String(part.error),
            });
            break;
          case "text-delta":
            sendMessage({ type: "chunk", content: part.text });
            break;
        }
      }

      sendMessage({ type: "done" });
    } catch (error) {
      console.error("[Vercel AI Gateway] Error in streaming handler:", error);
      sendMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

// =============================================================================
// Boost Streaming (port-based)
// =============================================================================

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "boostStream") return;

  port.onMessage.addListener(async (message) => {
    if (message.action !== "streamText") return;

    const request = message as StreamTextRequest;
    const sendMessage = (msg: StreamMessageType) => port.postMessage(msg);

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = activeTab?.id;

      if (!tabId) {
        sendMessage({
          type: "error",
          error: "No active tab found. Please ensure a tab is active.",
        });
        return;
      }

      const { gateway, config } = await getAIGateway();

      if (!request.messages || !Array.isArray(request.messages)) {
        sendMessage({ type: "error", error: "Invalid request: messages array is required" });
        return;
      }

      console.log(
        "[Vercel AI Gateway] Starting boost streaming request for model:",
        config.model,
        "on tab:",
        tabId,
      );

      const boostTools = await createBoostTools({ tabId, boostDrafts });

      const enableTools = request.enableTools !== false;
      const modelToUse = request.model || config.model;

      const defaultProviderOptions = {
        anthropic: {
          thinking: { type: "enabled" as const, budgetTokens: 10000 },
        },
      };

      const result = streamText({
        model: gateway(modelToUse),
        messages: request.messages,
        system: getBoostSystemPrompt({ url: activeTab.url, title: activeTab.title }),
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        topP: request.topP,
        topK: request.topK,
        presencePenalty: request.presencePenalty,
        frequencyPenalty: request.frequencyPenalty,
        stopSequences: request.stopSequences,
        seed: request.seed,
        maxRetries: request.maxRetries,
        headers: request.headers,
        stopWhen: stepCountIs(request.maxSteps ?? 5),
        ...(enableTools && {
          tools: boostTools as Record<string, unknown>,
          toolChoice: request.toolChoice ?? "auto",
        }),
        providerOptions: {
          ...defaultProviderOptions,
          ...request.providerOptions,
        },
      } as Parameters<typeof streamText>[0]);

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "reasoning-start":
            sendMessage({ type: "reasoning-start" });
            break;
          case "reasoning-delta":
            sendMessage({ type: "reasoning", content: part.text });
            break;
          case "reasoning-end":
            sendMessage({ type: "reasoning-end" });
            break;
          case "tool-input-start":
            sendMessage({ type: "tool-input-start", toolCallId: part.id, toolName: part.toolName });
            break;
          case "tool-input-delta":
            sendMessage({
              type: "tool-input-delta",
              toolCallId: part.id,
              inputTextDelta: part.delta,
            });
            break;
          case "tool-call":
            sendMessage({
              type: "tool-call",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            });
            break;
          case "tool-result":
            sendMessage({
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            });
            break;
          case "tool-error":
            sendMessage({
              type: "tool-error",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              errorText: part.error instanceof Error ? part.error.message : String(part.error),
            });
            break;
          case "text-delta":
            sendMessage({ type: "chunk", content: part.text });
            break;
        }
      }

      sendMessage({ type: "done" });
    } catch (error) {
      console.error("[Vercel AI Gateway] Error in boost streaming handler:", error);
      sendMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

// =============================================================================
// Initialization
// =============================================================================

initAssetStore()
  .then(() => {
    console.log("[Background] Asset store initialized successfully");
  })
  .catch((error) => {
    console.error("[Background] Failed to initialize asset store:", error);
  });
