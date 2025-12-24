type UUID = string;

function createCitation() {
  return {
    citationUUID: crypto.randomUUID(),
  };
}

export async function truncateAndGetChunks(text: string): Promise<{
  chunks: { citationUUID: UUID; text: string; timestamp?: number }[];
  truncated: boolean;
}> {
  let truncated = false;
  if (text.length > 100000) {
    text = text.slice(0, 100000);
    truncated = true;
  }
  const chunks = getSmartChunks(text);
  return { chunks, truncated };
}

export type ChunkOptions = {
  /** Minimum characters per chunk */
  minChars: number;
  /** Maximum characters per chunk */
  maxChars: number;
};

export function getSmartChunks(
  text: string,
  options?: ChunkOptions,
): { citationUUID: UUID; text: string }[] {
  const { minChars = 100, maxChars = 1000 } = options || {};

  if (minChars > maxChars) {
    throw new Error("minChars must be less than or equal to maxChars");
  }

  if (text.length <= maxChars) {
    return [{ ...createCitation(), text }];
  }

  // Split the text into paragraphs
  const paragraphs = splitByPattern(text, /\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // If adding this paragraph keeps us under maxChars
    if (currentChunk.length + paragraph.length + (currentChunk ? 2 : 0) <= maxChars) {
      if (currentChunk) {
        currentChunk += "\n\n" + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
    // If the paragraph alone exceeds maxChars, we need to split it
    else if (paragraph.length > maxChars) {
      // First, add the current chunk to our results if it's not empty
      if (currentChunk.length >= minChars) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      // Split paragraph into sentences
      const sentences = splitByPattern(paragraph, /(?<=[.!?])\s+/);

      // Try to chunk by sentences
      const sentenceChunks = chunkByBoundary(sentences, minChars, maxChars, "sentence");
      chunks.push(...sentenceChunks);
    }
    // If current chunk is big enough, store it and start a new one with this paragraph
    else if (currentChunk.length >= minChars) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    }
    // If current chunk is too small, we need to combine with part of this paragraph
    else {
      // Split paragraph into sentences to see if we can add some
      const sentences = splitByPattern(paragraph, /(?<=[.!?])\s+/);

      for (const sentence of sentences) {
        const separator = currentChunk ? " " : "";
        if (currentChunk.length + separator.length + sentence.length <= maxChars) {
          currentChunk += separator + sentence;
        } else {
          // This sentence would make chunk too big
          // If current chunk meets minimum, store it
          if (currentChunk.length >= minChars) {
            chunks.push(currentChunk);
            currentChunk = sentence;
          } else {
            // Need to split the sentence
            const [firstPart, secondPart] = splitSentence(
              currentChunk,
              sentence,
              minChars,
              maxChars,
            );
            chunks.push(firstPart);
            currentChunk = secondPart;
          }
        }
      }
    }
  }

  // Don't forget the last chunk if it's not empty and meets minimum size
  if (currentChunk.length >= minChars) {
    chunks.push(currentChunk);
  } else if (currentChunk.length > 0 && chunks.length > 0) {
    // Try to append to the last chunk if possible
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk.length + currentChunk.length + 1 <= maxChars) {
      chunks[chunks.length - 1] = lastChunk + " " + currentChunk;
    } else {
      chunks.push(currentChunk);
    }
  } else if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.map((chunk) => ({
    ...createCitation(),
    text: chunk,
  }));
}

function chunkByBoundary(
  elements: string[],
  minChars: number,
  maxChars: number,
  boundaryType: "paragraph" | "sentence" | "link" | "word",
): string[] {
  const result: string[] = [];
  let currentChunk = "";

  for (const element of elements) {
    let separator = "";
    if (currentChunk) {
      if (boundaryType === "sentence") {
        separator = " ";
      } else if (boundaryType === "paragraph") {
        separator = "\n\n";
      } else if (boundaryType === "word") {
        separator = " "; // Add space between words
      }
    }

    // If adding this element keeps us under maxChars
    if (currentChunk.length + separator.length + element.length <= maxChars) {
      currentChunk += separator + element;
    }
    // If element alone exceeds maxChars, we need to split it further
    else if (element.length > maxChars) {
      // First, add the current chunk to our results if it's not empty
      if (currentChunk.length >= minChars) {
        result.push(currentChunk);
        currentChunk = "";
      }

      // Split based on boundary type
      if (boundaryType === "sentence" || boundaryType === "paragraph") {
        // Split into markdown links
        const links = splitPreservingMarkdownLinks(element);
        const linkChunks = chunkByBoundary(links, minChars, maxChars, "link");
        result.push(...linkChunks);
      } else if (boundaryType === "link") {
        // Split into words
        const words = splitIntoWords(element);
        const wordChunks = chunkByBoundary(words, minChars, maxChars, "word");
        result.push(...wordChunks);
      } else {
        // Split the word into characters (last resort)
        const charChunks = chunkByCharacters(element, minChars, maxChars);
        result.push(...charChunks);
      }
    }
    // If current chunk is big enough, store it and start a new one
    else if (currentChunk.length >= minChars) {
      result.push(currentChunk);
      currentChunk = element;
    }
    // If current chunk is too small, we need to find a way to add more content
    else {
      if (boundaryType === "word") {
        // For words, we might need to split characters
        if (currentChunk.length > 0) {
          result.push(currentChunk);
        }

        const charChunks = chunkByCharacters(element, minChars, maxChars);
        result.push(...charChunks);
        currentChunk = "";
      } else {
        // Try to split the element into smaller parts
        const smallerParts = splitToNextLevel(element, boundaryType);

        for (const part of smallerParts) {
          if (currentChunk.length + part.length <= maxChars) {
            currentChunk += part;
          } else {
            // If we can't add this part, check if current chunk meets minimum
            if (currentChunk.length >= minChars) {
              result.push(currentChunk);
              currentChunk = part;
            } else {
              // Need to split at an even lower level
              const lowerLevelChunks = splitAtLowerLevel(
                currentChunk,
                part,
                minChars,
                maxChars,
                boundaryType,
              );
              result.push(lowerLevelChunks[0]);
              currentChunk = lowerLevelChunks[1];
              break;
            }
          }
        }
      }
    }
  }

  // Don't forget the last chunk if it's not empty and meets minimum size
  if (currentChunk.length >= minChars) {
    result.push(currentChunk);
  } else if (currentChunk.length > 0 && result.length > 0) {
    // Try to append to the last chunk if possible
    const lastChunk = result[result.length - 1];
    if (lastChunk.length + currentChunk.length + 1 <= maxChars) {
      result[result.length - 1] = lastChunk + " " + currentChunk;
    } else {
      result.push(currentChunk);
    }
  } else if (currentChunk.length > 0) {
    result.push(currentChunk);
  }

  return result;
}

function splitSentence(
  currentText: string,
  sentence: string,
  minChars: number,
  maxChars: number,
): [string, string] {
  // First check if we need to split markdown links
  if (containsMarkdownLinks(sentence)) {
    const parts = splitPreservingMarkdownLinks(sentence);
    let firstPart = currentText;
    let secondPart = "";

    // Try to add parts to the first chunk until we hit maxChars
    for (const part of parts) {
      if (firstPart.length + part.length <= maxChars) {
        firstPart += part;
      } else {
        // Start adding to the second chunk
        secondPart += part;
      }
    }

    return [firstPart, secondPart];
  } else {
    // Split into words
    const words = splitIntoWords(sentence);
    let firstPart = currentText;
    let secondPart = "";

    // Try to add words to the first chunk until we hit maxChars
    for (const word of words) {
      const separator = firstPart === currentText ? "" : " ";
      if (firstPart.length + separator.length + word.length <= maxChars) {
        firstPart += separator + word;
      } else {
        // Start adding to the second chunk
        const secondSeparator = secondPart ? " " : "";
        secondPart += secondSeparator + word;
      }
    }
    return [firstPart, secondPart];
  }
}

function containsMarkdownLinks(text: string): boolean {
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
  return markdownLinkRegex.test(text);
}

function splitPreservingMarkdownLinks(text: string): string[] {
  const markdownLinkRegex = /(\[([^\]]+)\]\(([^)]+)\))/g;
  const parts: string[] = [];

  let lastIndex = 0;
  let match;

  while ((match = markdownLinkRegex.exec(text)) !== null) {
    // Add text before the link if there is any
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the link
    parts.push(match[0]);

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last link
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.filter((part) => part.length > 0);
}

function getNextLevel(
  currentLevel: "paragraph" | "sentence" | "link" | "word",
): "sentence" | "link" | "word" | "character" {
  switch (currentLevel) {
    case "paragraph":
      return "sentence";
    case "sentence":
      return "link";
    case "link":
      return "word";
    case "word":
      return "character";
  }
}

function splitToNextLevel(
  element: string,
  currentLevel: "paragraph" | "sentence" | "link" | "word",
): string[] {
  switch (currentLevel) {
    case "paragraph":
      return splitByPattern(element, /(?<=[.!?])\s+/); // Split into sentences
    case "sentence":
      return splitPreservingMarkdownLinks(element);
    case "link":
      return splitIntoWords(element);
    case "word":
      return element.split(""); // Split into characters
  }
}

function splitAtLowerLevel(
  currentText: string,
  newElement: string,
  minChars: number,
  maxChars: number,
  currentLevel: "paragraph" | "sentence" | "link" | "word",
): [string, string] {
  const nextLevel = getNextLevel(currentLevel);

  // Split the new element at the next level
  const parts = splitToNextLevel(newElement, currentLevel);

  const result: [string, string] = ["", ""];
  let tempCurrentText = currentText;

  // Try to add parts to the first chunk until we hit maxChars
  for (const part of parts) {
    if (tempCurrentText.length + part.length <= maxChars) {
      tempCurrentText += part;
    } else {
      // If we can't add this part, check if current chunk meets minimum
      if (tempCurrentText.length >= minChars) {
        result[0] = tempCurrentText;
        // Start the second chunk with this part
        result[1] = part;
        break;
      } else {
        // Need to split at an even lower level
        if (nextLevel !== "character") {
          const lowerResult = splitAtLowerLevel(
            tempCurrentText,
            part,
            minChars,
            maxChars,
            nextLevel,
          );
          result[0] = lowerResult[0];
          result[1] = lowerResult[1];
          break;
        } else {
          // We're at character level, just split as needed
          const charResult = splitCharactersToMeetLimits(tempCurrentText, part, minChars, maxChars);
          result[0] = charResult[0];
          result[1] = charResult[1];
          break;
        }
      }
    }
  }

  // If we processed all parts without breaking, all fit in the first chunk
  if (result[0] === "") {
    result[0] = tempCurrentText;
  }

  return result;
}

function chunkByCharacters(text: string, minChars: number, maxChars: number): string[] {
  const result: string[] = [];

  // While text is longer than maxChars, keep chunking
  while (text.length > maxChars) {
    const chunk = text.substring(0, maxChars);
    result.push(chunk);
    text = text.substring(maxChars);
  }

  // Add the remaining text if it meets the minimum size
  if (text.length >= minChars) {
    result.push(text);
  } else if (text.length > 0 && result.length > 0) {
    // Append to the last chunk if possible
    const lastChunk = result[result.length - 1];
    if (lastChunk.length + text.length <= maxChars) {
      result[result.length - 1] = lastChunk + text;
    } else {
      // Otherwise just add it even though it's smaller than minChars
      result.push(text);
    }
  } else if (text.length > 0) {
    // If this is the only text and it's smaller than minChars, add it anyway
    result.push(text);
  }

  return result;
}

function splitCharactersToMeetLimits(
  currentText: string,
  text: string,
  minChars: number,
  maxChars: number,
): [string, string] {
  // Calculate how many characters we can add to currentText
  const availableSpace = maxChars - currentText.length;

  // If we can't add any characters, return currentText as is
  if (availableSpace <= 0) {
    return [currentText, text];
  }

  // Take as many characters as we can
  const firstPart = text.substring(0, Math.min(availableSpace, text.length));
  let secondPart = "";

  // If there are remaining characters, put them in the second part
  if (text.length > availableSpace) {
    secondPart = text.substring(availableSpace);
  }

  return [currentText + firstPart, secondPart];
}

function splitByPattern(text: string, pattern: RegExp): string[] {
  const parts = text.split(pattern);

  // Filter out empty parts
  return parts.filter((part) => part.length > 0);
}

function splitIntoWords(text: string): string[] {
  return splitByPattern(text, /\s+/);
}

function parseTimestampSegments(text: string): { timestamp?: number; text: string }[] {
  const timestampRegex = /[[(](\d{1,2}):(\d{2})(?::(\d{2}))?[\])]/g;
  const segments: { timestamp?: number; text: string }[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = timestampRegex.exec(text)) !== null) {
    // Add text before this timestamp (if any)
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index).trim();
      if (beforeText) {
        segments.push({ text: beforeText });
      }
    }

    // Calculate timestamp
    let timestamp: number;
    if (match[3] !== undefined) {
      // HH:MM:SS format
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      timestamp = hours * 3600 + minutes * 60 + seconds;
    } else {
      // MM:SS format
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      timestamp = minutes * 60 + seconds;
    }

    // Find the end of this segment (next timestamp or end of text)
    const nextMatch = timestampRegex.exec(text);
    const endIndex = nextMatch ? nextMatch.index : text.length;
    timestampRegex.lastIndex = match.index + match[0].length; // Reset for next iteration

    // Extract the text for this timestamp segment
    const segmentText = text.substring(match.index, endIndex).trim();
    if (segmentText) {
      segments.push({ timestamp, text: segmentText });
    }

    lastIndex = endIndex;
  }

  // Add any remaining text after the last timestamp
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex).trim();
    if (remainingText) {
      segments.push({ text: remainingText });
    }
  }

  return segments;
}

export function getYouTubeChunks(
  text: string,
  options?: ChunkOptions & { maxChunks?: number },
): { citationUUID: UUID; text: string; timestamp?: number }[] {
  const { maxChars = 800, maxChunks = 50 } = options || {};

  if (text.trim().length === 0) {
    return [];
  }

  const segments = parseTimestampSegments(text);

  if (segments.length === 0) {
    if (text.length <= maxChars) {
      return [{ ...createCitation(), text }];
    }
    return getSmartChunks(text, options);
  }

  const chunks: { citationUUID: UUID; text: string; timestamp?: number }[] = [];
  let currentChunk = "";
  let currentTimestamp: number | undefined;

  for (const segment of segments) {
    if (segment.timestamp !== undefined) {
      if (currentTimestamp === segment.timestamp && currentChunk.trim()) {
        if (currentChunk.length + segment.text.length + 1 > maxChars) {
          chunks.push({
            ...createCitation(),
            text: currentChunk.trim(),
            timestamp: currentTimestamp,
          });
          currentChunk = segment.text;
          currentTimestamp = segment.timestamp;
        } else {
          currentChunk += "\n" + segment.text;
        }
      } else {
        if (currentChunk.trim()) {
          chunks.push({
            ...createCitation(),
            text: currentChunk.trim(),
            timestamp: currentTimestamp,
          });
        }

        currentChunk = segment.text;
        currentTimestamp = segment.timestamp;
      }
    } else {
      if (currentChunk) {
        if (currentChunk.length + segment.text.length + 1 > maxChars) {
          chunks.push({
            ...createCitation(),
            text: currentChunk.trim(),
            timestamp: currentTimestamp,
          });
          currentChunk = segment.text;
          currentTimestamp = undefined;
        } else {
          currentChunk += "\n" + segment.text;
        }
      } else {
        currentChunk = segment.text;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      ...createCitation(),
      text: currentChunk.trim(),
      timestamp: currentTimestamp,
    });
  }

  // If we have too many chunks, combine some of them
  if (chunks.length > maxChunks) {
    const combinedChunks: { citationUUID: UUID; text: string; timestamp?: number }[] = [];
    const chunksPerGroup = Math.ceil(chunks.length / maxChunks);

    for (let i = 0; i < chunks.length; i += chunksPerGroup) {
      const chunksToMerge = chunks.slice(i, i + chunksPerGroup);

      // Use the earliest timestamp from the chunks being merged
      const earliestTimestamp = chunksToMerge
        .filter((chunk) => chunk.timestamp !== undefined)
        .map((chunk) => chunk.timestamp!)
        .sort((a, b) => a - b)[0];

      combinedChunks.push({
        ...createCitation(),
        text: chunksToMerge.map((chunk) => chunk.text).join("\n\n"),
        timestamp: earliestTimestamp,
      });
    }

    return combinedChunks.slice(0, maxChunks);
  }

  return chunks;
}

export function bufferSplitLineWithMaximum(buffer: string, maxLength: number) {
  // Returns prefix of a buffer.
  const regex = /\n+/m;

  const match = regex.exec(buffer);
  if (match) {
    return buffer.slice(0, match.index) + match?.[0];
  } else if (buffer.length > maxLength) {
    return buffer.slice(0, maxLength);
  } else {
    // null returned when we need more.
    return null;
  }
}
