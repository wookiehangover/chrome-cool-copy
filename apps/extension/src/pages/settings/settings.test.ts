import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorage, mockRuntime, resetChromeMocks } from "../../test/setup.js";
import { SUPPORTED_MODELS, type ModelCatalogResult } from "@repo/shared";

function requireElement<T extends HTMLElement>(id: string, constructor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) throw new Error(`Missing settings fixture #${id}`);
  return element;
}

function dispatchDOMContentLoaded(): void {
  document.dispatchEvent(new Event("DOMContentLoaded"));
}

describe("settings page", () => {
  beforeAll(async () => {
    document.body.innerHTML = `
      <form id="settingsForm"></form>
      <input id="apiKey" />
      <input id="token" />
      <input id="dbName" />
      <select id="dbType"><option value="sqlite">SQLite</option><option value="duckdb">DuckDB</option></select>
      <input id="aiGatewayApiKey" />
      <select id="aiGatewayModel"></select>
      <p id="modelCatalogStatus"></p>
      <button id="refreshModels" type="button"></button>
      <input id="shareServerHostname" />
      <input id="ttsServerUrl" />
      <input id="clipsServerUrl" />
      <input id="clipsServerApiToken" />
      <button id="testConnectionBtn" type="button"></button>
      <a id="backToPopup"></a>
      <div id="statusMessage"></div>
    `;
    await import("./settings.js");
  });

  beforeEach(() => {
    resetChromeMocks();
    for (const input of document.querySelectorAll("input")) input.value = "";
    mockStorage.sync.get.mockResolvedValue({});
    mockStorage.sync.set.mockResolvedValue(undefined);
    mockRuntime.sendMessage.mockImplementation((_message, callback) => {
      callback({ models: SUPPORTED_MODELS, source: "fallback" });
    });
  });

  it("ignores malformed storage values and applies safe defaults", async () => {
    mockStorage.sync.get.mockResolvedValue({
      agentdbConfig: { apiKey: 42, token: [] },
      aiGatewayConfig: { apiKey: {}, model: false },
      shareServerHostname: { hostname: "unsafe.example" },
      tts_url: 123,
      clipsServerConfig: { baseUrl: [], apiToken: null },
    });

    dispatchDOMContentLoaded();

    await vi.waitFor(() => {
      expect(requireElement("shareServerHostname", HTMLInputElement).value).toBe("localhost:5173");
      expect(requireElement("ttsServerUrl", HTMLInputElement).value).toBe("http://localhost:8000");
    });
    expect(requireElement("apiKey", HTMLInputElement).value).toBe("");
  });

  it("saves validated settings with a normalized database type", async () => {
    requireElement("apiKey", HTMLInputElement).value = "agent-key";
    requireElement("token", HTMLInputElement).value = "agent-token";
    requireElement("dbName", HTMLInputElement).value = "clips";
    requireElement("dbType", HTMLSelectElement).value = "duckdb";
    requireElement("aiGatewayApiKey", HTMLInputElement).value = "gateway-key";
    requireElement("aiGatewayModel", HTMLSelectElement).append(
      new Option("GPT", "openai/gpt-5.6-sol"),
    );
    requireElement("aiGatewayModel", HTMLSelectElement).value = "openai/gpt-5.6-sol";
    requireElement("shareServerHostname", HTMLInputElement).value = "https://share.example/";
    requireElement("ttsServerUrl", HTMLInputElement).value = "http://localhost:8000/";
    requireElement("clipsServerUrl", HTMLInputElement).value = "https://clips.example/";
    requireElement("clipsServerApiToken", HTMLInputElement).value = "clips-token";

    requireElement("settingsForm", HTMLFormElement).dispatchEvent(
      new Event("submit", { cancelable: true }),
    );

    await vi.waitFor(() => expect(mockStorage.sync.set).toHaveBeenCalledOnce());
    expect(mockStorage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        agentdbConfig: expect.objectContaining({ dbType: "duckdb" }),
        shareServerHostname: "share.example",
        tts_url: "http://localhost:8000",
        clipsServerConfig: {
          baseUrl: "https://clips.example",
          apiToken: "clips-token",
        },
      }),
    );
  });

  it("keeps a saved dynamic choice when discovery fails", async () => {
    mockStorage.sync.get.mockResolvedValue({
      aiGatewayConfig: { apiKey: "key", model: "new-lab/new-model" },
    });
    mockRuntime.sendMessage.mockImplementation((_message, callback) => {
      callback(undefined);
    });
    dispatchDOMContentLoaded();
    await vi.waitFor(() =>
      expect(requireElement("modelCatalogStatus", HTMLParagraphElement).textContent).toContain(
        "Could not load",
      ),
    );
    expect(requireElement("aiGatewayModel", HTMLSelectElement).value).toBe("new-lab/new-model");
    expect(mockStorage.sync.set).not.toHaveBeenCalled();
  });

  it("loads and refreshes the background catalog without replacing the selection", async () => {
    const catalog: ModelCatalogResult = {
      models: [
        {
          id: "new-lab/new-model",
          displayName: "New model",
          provider: "New lab",
          tags: [],
          recommended: false,
        },
      ],
      source: "live",
    };
    mockStorage.sync.get.mockResolvedValue({
      aiGatewayConfig: { apiKey: "key", model: "new-lab/new-model" },
    });
    mockRuntime.sendMessage.mockImplementation((_message, callback) => {
      callback(catalog);
    });
    dispatchDOMContentLoaded();
    await vi.waitFor(() =>
      expect(requireElement("modelCatalogStatus", HTMLParagraphElement).textContent).toBe(
        "Models are up to date.",
      ),
    );
    expect(
      requireElement("aiGatewayModel", HTMLSelectElement).selectedOptions[0]?.textContent,
    ).toBe("New model");
    requireElement("refreshModels", HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: "getModelCatalog", refresh: true },
        expect.any(Function),
      ),
    );
    expect(requireElement("aiGatewayModel", HTMLSelectElement).value).toBe("new-lab/new-model");
  });
});
