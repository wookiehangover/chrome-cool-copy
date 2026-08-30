/**
 * Handler function signature for chrome.runtime.onMessage handlers.
 * Returns true if the handler will send a response asynchronously,
 * false if it handled the message synchronously (or didn't handle it).
 */
type ChromeMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
export type BrowserMessage = Parameters<ChromeMessageListener>[0];
export type BrowserResponse = Parameters<Parameters<ChromeMessageListener>[2]>[0];

export type MessageHandler = (
  message: BrowserMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: BrowserResponse) => void,
) => boolean;

/**
 * A map of action names to their handler functions.
 */
export type HandlerMap = Record<string, MessageHandler>;
