/**
 * TypeScript definitions for Darkmode.js
 * https://github.com/sandoche/Darkmode.js
 */

interface DarkmodeOptions {
  /** Position from bottom (default: '32px') */
  bottom?: string;
  /** Position from right (default: '32px') */
  right?: string;
  /** Position from left (default: 'unset') */
  left?: string;
  /** Transition time (default: '0.3s') */
  time?: string;
  /** Mix color for dark mode effect (default: '#fff') */
  mixColor?: string;
  /** Background color (default: '#fff') */
  backgroundColor?: string;
  /** Button color in dark mode (default: '#100f2c') */
  buttonColorDark?: string;
  /** Button color in light mode (default: '#fff') */
  buttonColorLight?: string;
  /** Save preference in cookies (default: true) */
  saveInCookies?: boolean;
  /** Label for the toggle button (default: '') */
  label?: string;
  /** Auto match OS theme preference (default: true) */
  autoMatchOsTheme?: boolean;
}

declare class Darkmode {
  constructor(options?: DarkmodeOptions);

  /**
   * Show the dark mode toggle widget
   */
  showWidget(): void;

  /**
   * Toggle dark mode on/off
   */
  toggle(): void;

  /**
   * Check if dark mode is currently activated
   * @returns true if dark mode is active, false otherwise
   */
  isActivated(): boolean | null;

  /**
   * Reference to the toggle button element
   */
  button: HTMLButtonElement;

  /**
   * Reference to the dark mode layer element
   */
  layer: HTMLDivElement;

  /**
   * Whether preferences are saved in cookies
   */
  saveInCookies: boolean;

  /**
   * Transition time
   */
  time: string;
}

declare global {
  interface Window {
    Darkmode: typeof Darkmode;
  }
}

export = Darkmode;
