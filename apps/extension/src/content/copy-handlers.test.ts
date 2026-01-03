/**
 * Copy Handlers Tests
 * Tests for table to CSV conversion functionality
 */

import { describe, it, expect, beforeEach } from "vitest";

// Helper function to create a DOM element with HTML content
function createElementFromHTML(html: string): Element {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

/**
 * Convert a table element to CSV format
 * This mirrors the implementation in copy-handlers.ts
 */
function tableToCSV(tableElement: Element): string {
  try {
    // Find the actual table element if the selected element contains a table
    const table =
      tableElement.tagName === "TABLE" ? tableElement : tableElement.querySelector("table");

    if (!table) {
      throw new Error("No table found in element");
    }

    // Get all rows
    const rows = Array.from(table.querySelectorAll("tr"));

    if (rows.length === 0) {
      throw new Error("Table has no rows");
    }

    // Create a 2D array to handle merged cells
    const maxCols = Math.max(
      ...rows.map((row) => {
        let colCount = 0;
        Array.from(row.querySelectorAll("td, th")).forEach((cell) => {
          colCount += parseInt(cell.getAttribute("colspan") || "1");
        });
        return colCount;
      }),
    );

    // Build the CSV data
    const cellMatrix = Array(rows.length)
      .fill(null)
      .map(() => Array(maxCols).fill(""));

    rows.forEach((row, rowIndex) => {
      let colIndex = 0;
      const cells = Array.from(row.querySelectorAll("td, th"));

      cells.forEach((cell) => {
        // Skip already filled cells (from colspan/rowspan)
        while (colIndex < maxCols && cellMatrix[rowIndex][colIndex] !== "") {
          colIndex++;
        }

        const colspan = parseInt(cell.getAttribute("colspan") || "1");
        const rowspan = parseInt(cell.getAttribute("rowspan") || "1");
        const cellText = cell.textContent?.trim() || "";

        // Fill the cell and handle colspan/rowspan
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            if (rowIndex + r < rows.length) {
              cellMatrix[rowIndex + r][colIndex + c] = cellText;
            }
          }
        }

        colIndex += colspan;
      });
    });

    // Convert matrix to CSV
    const csvContent = cellMatrix
      .map((row) => {
        return row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma, newline, or quote
            const escaped = cell.replace(/"/g, '""');
            if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')) {
              return `"${escaped}"`;
            }
            return escaped;
          })
          .join(",");
      })
      .join("\n");

    return csvContent;
  } catch (error) {
    console.error("Error converting table to CSV:", error);
    throw error;
  }
}

describe("tableToCSV", () => {
  describe("Basic table conversion", () => {
    it("should convert a simple table to CSV", () => {
      const html = `<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe("A,B\nC,D");
    });

    it("should handle tables with header cells (th)", () => {
      const html = `<table><tr><th>Header1</th><th>Header2</th></tr><tr><td>A</td><td>B</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe("Header1,Header2\nA,B");
    });

    it("should handle single row table", () => {
      const html = `<table><tr><td>A</td><td>B</td><td>C</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe("A,B,C");
    });

    it("should handle single column table", () => {
      const html = `<table><tr><td>A</td></tr><tr><td>B</td></tr><tr><td>C</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe("A\nB\nC");
    });
  });

  describe("Colspan handling", () => {
    it("should handle colspan in first row", () => {
      const html = `<table><tr><td colspan="2">Merged</td></tr><tr><td>A</td><td>B</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe("Merged,Merged\nA,B");
    });

    it("should handle colspan in middle row", () => {
      const html = `<table><tr><td>A</td><td>B</td></tr><tr><td colspan="2">Merged</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe("A,B\nMerged,Merged");
    });
  });

  describe("CSV escaping", () => {
    it("should escape commas in cell content", () => {
      const html = `<table><tr><td>Hello, World</td><td>Test</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe('"Hello, World",Test');
    });

    it("should escape quotes in cell content", () => {
      const html = `<table><tr><td>Say "Hi"</td><td>Test</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe('"Say ""Hi""",Test');
    });

    it("should escape newlines in cell content", () => {
      const html = `<table><tr><td>Line1\nLine2</td><td>Test</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe('"Line1\nLine2",Test');
    });
  });

  describe("Error handling", () => {
    it("should throw error when no table found", () => {
      const html = `<div>No table here</div>`;
      const element = createElementFromHTML(html);
      expect(() => tableToCSV(element)).toThrow("No table found in element");
    });

    it("should throw error when table has no rows", () => {
      const html = `<table></table>`;
      const element = createElementFromHTML(html);
      expect(() => tableToCSV(element)).toThrow("Table has no rows");
    });
  });

  describe("Empty cells", () => {
    it("should handle empty cells", () => {
      const html = `<table><tr><td>A</td><td></td><td>C</td></tr></table>`;
      const element = createElementFromHTML(html);
      const result = tableToCSV(element);
      expect(result).toBe("A,,C");
    });
  });
});

