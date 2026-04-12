/**
 * Handler function signature for chrome.runtime.onMessage handlers.
 * Returns true if the handler will send a response asynchronously,
 * false if it handled the message synchronously (or didn't handle it).
 */
export type MessageHandler = (
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean;

/**
 * A map of action names to their handler functions.
 */
export type HandlerMap = Record<string, MessageHandler>;
