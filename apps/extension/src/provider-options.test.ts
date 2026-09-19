import { describe, expect, it } from "vitest";
import { getDefaultProviderOptions } from "./provider-options";

describe("default provider options", () => {
  it.each(["anthropic/claude-fable-5", "anthropic/claude-opus-5", "anthropic/claude-opus-4.8"])(
    "uses adaptive thinking for %s",
    (model) => {
      expect(getDefaultProviderOptions(model)).toEqual({
        anthropic: {
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
        },
      });
    },
  );

  it("preserves the legacy thinking fallback", () => {
    expect(getDefaultProviderOptions("anthropic/claude-sonnet-4.6")).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 10000 } },
    });
  });
});
