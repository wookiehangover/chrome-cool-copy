import type { JSONObject, JSONValue } from "../types/index.js";

export function parseJSONObject(text: string): JSONObject | undefined {
  try {
    const value: JSONValue = JSON.parse(text);
    if (
      value === null ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return undefined;
    }

    // SAFETY: JSON.parse produced a JSONValue and the prototype/array checks establish
    // that its root is a plain JSON object rather than a primitive or array.
    return value as JSONObject;
  } catch {
    return undefined;
  }
}
