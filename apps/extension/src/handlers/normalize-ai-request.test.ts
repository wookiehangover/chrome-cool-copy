import { describe, expect, it } from "vitest";
import { normalizeAIRequest } from "./normalize-ai-request.js";

describe("normalizeAIRequest", () => {
  it("keeps ordinary conversation messages unchanged", () => {
    expect(
      normalizeAIRequest({
        messages: [
          { role: "user", content: "one" },
          { role: "assistant", content: "two" },
        ],
      }),
    ).toEqual({
      messages: [
        { role: "user", content: "one" },
        { role: "assistant", content: "two" },
      ],
    });
  });

  it("combines explicit and legacy instructions while preserving conversation order", () => {
    expect(
      normalizeAIRequest({
        instructions: "explicit",
        system: "legacy top level",
        messages: [
          { role: "system", content: "first legacy message" },
          { role: "user", content: "one" },
          { role: "system", content: "second legacy message" },
          { role: "assistant", content: "two" },
        ],
      }),
    ).toEqual({
      instructions: "explicit\n\nlegacy top level\n\nfirst legacy message\n\nsecond legacy message",
      messages: [
        { role: "user", content: "one" },
        { role: "assistant", content: "two" },
      ],
    });
  });
});
