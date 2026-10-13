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
const results = [];

files.forEach(file => {
  const content = fs.readFileSync(file, "utf-8");
  const relPath = path.relative(rootDir, file);

  // Look for Button, button, or anchor tags or cva definitions
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    // Check if line has green border (e.g. border-[#B1FA63], border-lime-400, border-lime-500, etc.)
    const hasGreenBorder = /(?:border|ring)-(?:\[#B1FA63\]|\[#CCFF00\]|lime-400|lime-500|lime-300|emerald-500)/i.test(line);
    const hasGreenHover = /hover:bg-(?:\[#B1FA63\]|\[#CCFF00\]|lime-400|lime-300|emerald-500)/i.test(line);
    const hasHoverTextWhite = /hover:text-white/i.test(line);
    const hasHoverTextBlack = /hover:text-black/i.test(line);

    if (hasGreenBorder || hasGreenHover) {
      results.push({
        file: relPath,
        lineNum: idx + 1,
        code: line.trim()
      });
    }
  });
});

console.log(`Total found: ${results.length}`);
results.forEach(r => console.log(`${r.file}:${r.lineNum} -> ${r.code}`));
