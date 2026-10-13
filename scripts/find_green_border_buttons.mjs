import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "src");

const extensions = new Set([".tsx", ".ts", ".jsx", ".js", ".html", ".css"]);

function walk(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(srcDir);
const matches = [];

// Look for patterns like border with green/lime and hover:bg with green/lime
const greenBorderRegex = /border-(?:\[#B1FA63\]|\[#CCFF00\]|lime|emerald|green)/i;
const hoverGreenRegex = /hover:bg-(?:\[#B1FA63\]|\[#CCFF00\]|lime|emerald|green)/i;
const hoverTextWhiteRegex = /hover:text-white/i;

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    const hasGreenBorder = greenBorderRegex.test(line);
    const hasHoverGreen = hoverGreenRegex.test(line);
    const hasHoverWhite = hoverTextWhiteRegex.test(line);
    const isButtonOrElem = /button|btn|link|<a|<button|Button|variant/i.test(line) || hasGreenBorder || hasHoverGreen;

    if (isButtonOrElem && (hasGreenBorder || (hasHoverGreen && hasHoverWhite))) {
      matches.push({
        file: path.relative(rootDir, file),
        lineNum: idx + 1,
        line: line.trim()
      });
    }
  });
}

console.log(`Found ${matches.length} matching lines:`);
matches.forEach(m => {
  console.log(`${m.file}:${m.lineNum} -> ${m.line}`);
});
