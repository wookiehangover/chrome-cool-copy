import { describe, expect, it } from "vitest";
import { parseJSONObject } from "./json.js";

describe("parseJSONObject", () => {
  it("parses recursively JSON-shaped objects", () => {
    expect(parseJSONObject('{"title":"Example","nested":{"count":2},"items":[true,null]}')).toEqual(
      {
        title: "Example",
        nested: { count: 2 },
        items: [true, null],
      },
    );
  });

  it.each(["[]", '"text"', "42", "null", "not json"])(
    "rejects a non-object JSON boundary: %s",
    (input) => {
      expect(parseJSONObject(input)).toBeUndefined();
    },
  );
});
