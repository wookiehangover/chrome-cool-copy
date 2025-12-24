/**
 * Test suite for tableToCSV function
 * This file contains unit tests for the CSV conversion functionality
 */

// Copy the tableToCSV function from content.js for testing
function tableToCSV(tableElement) {
  try {
    const table = tableElement.tagName === 'TABLE'
      ? tableElement
      : tableElement.querySelector('table');

    if (!table) {
      throw new Error('No table found in element');
    }

    const rows = Array.from(table.querySelectorAll('tr'));

    if (rows.length === 0) {
      throw new Error('Table has no rows');
    }

    const maxCols = Math.max(...rows.map(row => {
      let colCount = 0;
      Array.from(row.querySelectorAll('td, th')).forEach(cell => {
        colCount += parseInt(cell.getAttribute('colspan') || 1);
      });
      return colCount;
    }));

    const cellMatrix = Array(rows.length).fill(null).map(() => Array(maxCols).fill(''));

    rows.forEach((row, rowIndex) => {
      let colIndex = 0;
      const cells = Array.from(row.querySelectorAll('td, th'));

      cells.forEach(cell => {
        while (colIndex < maxCols && cellMatrix[rowIndex][colIndex] !== '') {
          colIndex++;
        }

        const colspan = parseInt(cell.getAttribute('colspan') || 1);
        const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
        const cellText = cell.textContent.trim();

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

    const csvContent = cellMatrix.map(row => {
      return row.map(cell => {
        const escaped = cell.replace(/"/g, '""');
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
          return `"${escaped}"`;
        }
        return escaped;
      }).join(',');
    }).join('\n');

    return csvContent;
  } catch (error) {
    console.error('Error converting table to CSV:', error);
    throw error;
  }
}

// Test cases
const tests = [
  {
    name: 'Simple table',
    html: `<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>`,
    expected: 'A,B\nC,D'
  },
  {
    name: 'Table with colspan',
    html: `<table><tr><td colspan="2">Merged</td></tr><tr><td>A</td><td>B</td></tr></table>`,
    expected: 'Merged,Merged\nA,B'
  },
  {
    name: 'CSV escaping - commas',
    html: `<table><tr><td>Hello, World</td><td>Test</td></tr></table>`,
    expected: '"Hello, World",Test'
  },
  {
    name: 'CSV escaping - quotes',
    html: `<table><tr><td>Say "Hi"</td><td>Test</td></tr></table>`,
    expected: '"Say ""Hi""",Test'
  },
  {
    name: 'CSV escaping - newlines',
    html: `<table><tr><td>Line1\nLine2</td><td>Test</td></tr></table>`,
    expected: '"Line1\nLine2",Test'
  }
];

// Run tests
console.log('Running tableToCSV tests...\n');
let passed = 0;
let failed = 0;

tests.forEach(test => {
  try {
    const div = document.createElement('div');
    div.innerHTML = test.html;
    const result = tableToCSV(div);
    
    if (result === test.expected) {
      console.log(`✓ ${test.name}`);
      passed++;
    } else {
      console.log(`✗ ${test.name}`);
      console.log(`  Expected: ${JSON.stringify(test.expected)}`);
      console.log(`  Got:      ${JSON.stringify(result)}`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ ${test.name} - Error: ${error.message}`);
    failed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);

