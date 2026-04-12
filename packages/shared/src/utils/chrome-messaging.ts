/**
 * Typed wrapper around chrome.runtime.sendMessage with Promise-based error handling.
 *
 * Handles both `chrome.runtime.lastError` and response-level errors (`response.success === false`).
 *
 * @param message - The message object to send (typically includes `action` or `type` key)
 * @param options - Optional configuration for response extraction
 * @returns Promise resolving to the extracted response value
 *
 * @example
 * // Returns response.data
 * const clips = await sendMessage<Clip[]>({ action: "getLocalClips" }, { responseKey: "data" });
 *
 * @example
 * // Returns full response object
 * const response = await sendMessage<GenerateTextResponse>({ action: "generateText", ... });
 *
 * @example
 * // Fire-and-forget (still checks for errors)
 * await sendMessage({ action: "deleteClip", clipId: id });
 */
export function sendMessage<T = unknown>(
  message: Record<string, unknown> | object,
  options?: {
    /**
     * Key to extract from the response object.
     * If set, returns `response[responseKey]` on success.
     * If not set, returns the full response object.
     */
    responseKey?: string;
  },
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: Record<string, unknown>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.success === false) {
        reject(new Error((response?.error as string) || "Chrome runtime message failed"));
        return;
      }
      if (options?.responseKey) {
        resolve(response?.[options.responseKey] as T);
      } else {
        resolve(response as T);
      }
    });
  });
}
