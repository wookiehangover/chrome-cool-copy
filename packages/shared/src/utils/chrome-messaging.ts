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
type RuntimeResponse<T, ResponseKey extends string> = {
  success?: boolean;
  error?: string;
} & { [Key in ResponseKey]?: T };

export function sendMessage<
  T = unknown,
  Message extends object = object,
  ResponseKey extends string = string,
>(
  message: Message,
  options?: {
    /**
     * Key to extract from the response object.
     * If set, returns `response[responseKey]` on success.
     * If not set, returns the full response object.
     */
    responseKey?: ResponseKey;
  },
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage<Message, RuntimeResponse<T, ResponseKey> | undefined>(
      message,
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.success === false) {
          reject(new Error(response.error || "Chrome runtime message failed"));
          return;
        }
        if (options?.responseKey) {
          const value = response?.[options.responseKey];
          // SAFETY: This wrapper's protocol makes the selected field's decoding the caller's
          // responsibility; Chrome supplies no runtime schema for extension message responses.
          resolve(value as T);
        } else {
          // SAFETY: This wrapper's protocol makes response decoding the caller's responsibility;
          // Chrome supplies no runtime schema for extension message responses.
          resolve(response as T);
        }
      },
    );
  });
}
