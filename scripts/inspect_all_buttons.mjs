import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "src");

function walk(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (entry.isFile() && /\.(tsx|ts|jsx|js|html)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(srcDir);
const report = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  const relPath = path.relative(rootDir, file);

  // Search for buttons or elements that have green border or hover green
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    // Check if line contains button / Button or classes related to buttons
    const hasGreenBorder = /border-(?:\[#B1FA63\]|\[#CCFF00\]|lime|emerald|green)/i.test(line);
    const hasHoverGreen = /hover:bg-(?:\[#B1FA63\]|\[#CCFF00\]|lime|emerald|green)/i.test(line);
    const hasHoverWhite = /hover:text-white/i.test(line);
    const hasHoverBlack = /hover:text-black/i.test(line);

    if (hasGreenBorder || hasHoverGreen) {
      report.push({
        file: relPath,
        line: index + 1,
        text: line.trim(),
        hasGreenBorder,
        hasHoverGreen,
        hasHoverWhite,
        hasHoverBlack
      });
    }
  });
}

console.log(JSON.stringify(report, null, 2));
