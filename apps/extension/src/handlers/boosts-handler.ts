import {
  getBoosts,
  saveBoost as persistBoost,
  toggleBoost,
  deleteBoost,
  updateBoost,
  getBoostsForDomain,
} from "../services/boosts";
import type { Boost } from "@repo/shared";
import type { HandlerMap } from "./types";

/**
 * In-memory draft state for boost code per tab.
 * Exported so the boostStream onConnect listener can access it.
 */
export const boostDrafts = new Map<number, string>();

/**
 * Execute boost code in a tab using script tag injection to bypass CSP.
 * This works on pages that have 'unsafe-inline' but not 'unsafe-eval'.
 */
export async function executeBoostCode(
  tabId: number,
  code: string,
): Promise<{ success: boolean; result?: string; error?: string }> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (codeToExecute: string) => {
      return new Promise<{ success: boolean; result?: string; error?: string }>((resolve) => {
        try {
          const resultId = `__boost_result_${Date.now()}_${Math.random().toString(36).slice(2)}`;

          const wrappedCode = `
            (function() {
              try {
                const __boostResult = (function() {
                  ${codeToExecute}
                })();
                window["${resultId}"] = { success: true, result: __boostResult !== undefined ? String(__boostResult) : undefined };
              } catch (error) {
                window["${resultId}"] = { success: false, error: error instanceof Error ? error.message : String(error) };
              }
            })();
          `;

          const script = document.createElement("script");
          script.textContent = wrappedCode;
          document.documentElement.appendChild(script);
          script.remove();

          const result = (window as unknown as Record<string, unknown>)[resultId] as
            | { success: boolean; result?: string; error?: string }
            | undefined;
          delete (window as unknown as Record<string, unknown>)[resultId];

          if (result) {
            resolve(result);
          } else {
            resolve({ success: true, result: "Boost executed (no return value)" });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
    args: [code],
  });

  return (await results[0]?.result) || { success: false, error: "No result from script execution" };
}

export const boostsHandlers: HandlerMap = {
  boostFile: (message, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ success: false, error: "No tab ID available" });
      return false;
    }

    try {
      const { content } = message as { content: string };
      if (typeof content !== "string") {
        throw new Error("Content must be a string");
      }

      boostDrafts.set(tabId, content);
      console.log("[Boosts] Stored draft for tab", tabId, `(${content.length} bytes)`);

      sendResponse({
        success: true,
        message: `Boost code updated (${content.length} bytes)`,
      });
    } catch (error) {
      console.error("[Boosts] Error in boostFile handler:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return false;
  },

  executeBoost: (message, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ success: false, error: "No tab ID available" });
      return false;
    }

    (async () => {
      try {
        const code = boostDrafts.get(tabId);
        if (!code) {
          throw new Error("No boost code stored for this tab");
        }
        const result = await executeBoostCode(tabId, code);
        sendResponse(result);
      } catch (error) {
        console.error("[Boosts] Error in executeBoost handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  readConsole: (_message, _sender, sendResponse) => {
    const message = _message;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }

      const lines = typeof message.lines === "number" ? message.lines : 20;

      chrome.tabs.sendMessage(tabId, { action: "readConsole", lines }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse(response);
      });
    });
    return true;
  },

  getBoosts: (_message, _sender, sendResponse) => {
    (async () => {
      try {
        const boosts = await getBoosts();
        sendResponse({ success: true, data: boosts });
      } catch (error) {
        console.error("[Boosts] Error in getBoosts handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  saveBoost: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const { action: _action, ...payload } = message as { action?: string } & Omit<
          Boost,
          "id" | "createdAt" | "updatedAt"
        >;
        const boost = await persistBoost(payload);
        console.log("[Boosts] Boost saved successfully:", boost.id);
        sendResponse({ success: true, boost });
      } catch (error) {
        console.error("[Boosts] Error saving boost:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  toggleBoost: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const { id } = message as { id: string };
        if (!id) {
          throw new Error("Boost ID is required");
        }
        const boost = await toggleBoost(id);
        sendResponse({ success: true, data: boost });
      } catch (error) {
        console.error("[Boosts] Error in toggleBoost handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  deleteBoost: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const { id } = message as { id: string };
        if (!id) {
          throw new Error("Boost ID is required");
        }
        const success = await deleteBoost(id);
        sendResponse({ success, data: success });
      } catch (error) {
        console.error("[Boosts] Error in deleteBoost handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  updateBoost: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const { id, updates } = message as { id: string; updates: Record<string, unknown> };
        if (!id) {
          throw new Error("Boost ID is required");
        }
        const boost = await updateBoost(id, updates);
        if (!boost) {
          throw new Error("Boost not found");
        }
        sendResponse({ success: true, boost });
      } catch (error) {
        console.error("[Boosts] Error in updateBoost handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  runBoost: (message, sender, sendResponse) => {
    (async () => {
      try {
        let tabId = sender.tab?.id;
        if (tabId === undefined) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = activeTab?.id;
        }

        if (tabId === undefined) {
          sendResponse({ success: false, error: "No tab ID available" });
          return;
        }

        const { boostId, id } = message as { boostId?: string; id?: string };
        const boostIdToUse = boostId || id;
        if (!boostIdToUse) {
          throw new Error("Boost ID is required");
        }

        const boosts = await getBoosts();
        const boost = boosts.find((b) => b.id === boostIdToUse);
        if (!boost) {
          throw new Error("Boost not found");
        }

        const result = await executeBoostCode(tabId, boost.code);
        sendResponse(result);
      } catch (error) {
        console.error("[Boosts] Error in runBoost handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  getBoostsForDomain: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const { hostname } = message as { hostname: string };
        if (!hostname) {
          throw new Error("Hostname is required");
        }
        const boosts = await getBoostsForDomain(hostname);
        sendResponse({ success: true, boosts });
      } catch (error) {
        console.error("[Boosts] Error in getBoostsForDomain handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  getAutoBoosts: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const { domain } = message as { domain: string };
        if (!domain) {
          throw new Error("Domain is required");
        }
        const boosts = await getBoostsForDomain(domain);
        const autoBoosts = boosts.filter((b) => b.runMode === "auto");
        sendResponse({ success: true, data: autoBoosts });
      } catch (error) {
        console.error("[Boosts] Error in getAutoBoosts handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },
};
