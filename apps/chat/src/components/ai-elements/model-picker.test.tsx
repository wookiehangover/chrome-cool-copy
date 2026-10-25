import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ModelCatalogResult } from "@repo/shared";
import { mockRuntime } from "@/test/setup";
import { ModelPicker } from "./model-picker";

const catalog: ModelCatalogResult = {
  source: "live",
  models: [
    {
      id: "alpha/reasoner",
      displayName: "Alpha Reasoner",
      provider: "Host",
      creator: "Alpha",
      recommended: true,
      tags: ["reasoning"],
      inputPrice: 0.000002,
      outputPrice: 0.000008,
      contextWindow: 128000,
      variablePricing: true,
    },
    {
      id: "beta/chat",
      displayName: "Beta Chat",
      provider: "Host",
      creator: "Beta",
      recommended: true,
    },
    {
      id: "beta/experimental",
      displayName: "New Experiment",
      provider: "Host",
      creator: "Beta",
      recommended: false,
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  mockRuntime.sendMessage.mockImplementation((_message, callback) => callback(catalog));
});
afterEach(() => cleanup());

async function openPicker(value = "alpha/reasoner") {
  const onValueChange = vi.fn();
  render(<ModelPicker value={value} onValueChange={onValueChange} />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: value === "alpha/reasoner" ? "Alpha Reasoner" : value }),
    ).toBeDefined(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: value === "alpha/reasoner" ? "Alpha Reasoner" : value }),
  );
  await screen.findByRole("combobox", { name: "Search models" });
  return onValueChange;
}

describe("ModelPicker", () => {
  it("searches names, IDs, and creators and allows alternatives outside recommendations", async () => {
    await openPicker();
    expect(screen.queryByRole("option", { name: /New Experiment/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Model collection"), { target: { value: "all" } });
    const search = screen.getByRole("combobox", { name: "Search models" });
    for (const query of ["New Experiment", "beta/experimental"]) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getByRole("option", { name: /New Experiment/ })).toBeDefined();
      expect(screen.queryByRole("option", { name: /Alpha Reasoner/ })).toBeNull();
    }
    fireEvent.change(search, { target: { value: "Beta" } });
    expect(
      screen.getAllByRole("option").filter((option) => option.hasAttribute("cmdk-item")),
    ).toHaveLength(2);
    fireEvent.change(search, { target: { value: "nothing matches" } });
    expect(screen.getByText(/No models match/)).toBeDefined();
  });

  it("filters by creator and reasoning and shows base prices and context", async () => {
    await openPicker();
    fireEvent.click(screen.getByLabelText("Reasoning"));
    expect(screen.queryByRole("option", { name: /Beta Chat/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Alpha Reasoner/ }).textContent).toContain(
      "$2.00 in / $8.00 out per 1M",
    );
    expect(screen.getByRole("option", { name: /Alpha Reasoner/ }).textContent).toContain(
      "128,000 context",
    );
    fireEvent.click(screen.getByLabelText("Reasoning"));
    fireEvent.change(screen.getByLabelText("Model creator"), { target: { value: "Beta" } });
    expect(screen.queryByRole("option", { name: /Alpha Reasoner/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Beta Chat/ })).toBeDefined();
  });

  it("selects a search result with the keyboard and closes the dialog", async () => {
    const change = await openPicker();
    const input = screen.getByRole("combobox", { name: "Search models" });
    fireEvent.change(input, { target: { value: "Beta" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(change).toHaveBeenCalledWith("beta/chat"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("preserves and displays a saved model absent from the catalog", async () => {
    const change = await openPicker("missing/saved-model");
    expect(screen.getByText(/not in the current catalog; your choice is preserved/)).toBeDefined();
    expect(change).not.toHaveBeenCalled();
  });

  it("offers retry after failure and loads the refreshed models", async () => {
    mockRuntime.sendMessage.mockImplementationOnce((_message, callback) =>
      callback({ ...catalog, source: "cache", error: "Catalog offline" }),
    );
    await openPicker();
    expect(screen.getByRole("alert").textContent).toBe("Catalog offline");
    fireEvent.click(screen.getByRole("button", { name: "Retry loading models" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(mockRuntime.sendMessage).toHaveBeenLastCalledWith(
      { action: "getModelCatalog", refresh: true },
      expect.any(Function),
    );
  });
});
