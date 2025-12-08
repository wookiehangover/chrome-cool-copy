/**
 * Copy text to clipboard
 * @param {string} text - The text to copy
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Copy image blob to clipboard
 * @param {Blob} blob - The image blob to copy
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    const item = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (error) {
    console.error("Failed to copy image to clipboard:", error);
    return false;
  }
}

