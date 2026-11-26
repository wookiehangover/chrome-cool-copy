/**
 * Shared helpers for isolated Web Component overlays in extension content scripts.
 *
 * Chrome MV3 isolated-world content scripts expose `window.customElements` as `null`
 * (Chromium issue 40380222). These helpers register native custom elements whenever
 * the registry is available and allow mounting the exact same custom-tagged host
 * element and closed Shadow DOM controller when it is not.
 */

const KEYBOARD_EVENTS: readonly string[] = ["keydown", "keyup", "keypress", "input", "beforeinput"];

/**
 * Safely register a custom element when the browser exposes `customElements`.
 * Returns `true` if the custom element is registered natively, `false` otherwise.
 */
export function defineCustomElement(tagName: string, ctor: CustomElementConstructor): boolean {
  const registry = globalThis.customElements;
  if (!registry) {
    return false;
  }

  try {
    if (!registry.get(tagName)) {
      registry.define(tagName, ctor);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Mount a custom host element outside `document.body` so page-level body layout,
 * transforms, filters, and SPA body reconciliation do not affect the overlay.
 */
export function mountOverlayHost(host: HTMLElement): void {
  const target = document.documentElement || document.body;
  if (target && !host.isConnected) {
    target.appendChild(host);
  }
}

/**
 * Prevent keyboard and input events originating inside a Shadow DOM overlay from
 * bubbling out to host page shortcuts (e.g. GitHub, X, Gmail, YouTube hotkeys).
 */
export function isolateKeyboardEvents(root: EventTarget, signal: AbortSignal): void {
  const stop = (event: Event): void => {
    event.stopPropagation();
  };

  for (const eventName of KEYBOARD_EVENTS) {
    root.addEventListener(eventName, stop, { signal });
  }
}
