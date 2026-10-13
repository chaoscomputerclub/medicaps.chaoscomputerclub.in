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
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(srcDir);
const targetLines = [];

files.forEach(file => {
  const content = fs.readFileSync(file, "utf-8");
  const relPath = path.relative(rootDir, file);
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    // We are looking for button elements or classes that:
    // 1. Have default green border (border-[#B1FA63], border-lime-400, etc.) on buttons/interactive elements
    // 2. OR hover with green and text-white (or hover:border-lime with hover:text-white)
    // 3. OR buttons overriding outline with hover:border-[#B1FA63] text-white hover:text-white
    const isButtonContext = /button|Button|variant="outline"|asChild|role="button"/i.test(line) ||
      (idx > 0 && /<Button|<button/i.test(lines[idx - 1])) ||
      (idx > 1 && /<Button|<button/i.test(lines[idx - 2]));

    const hasGreenBorder = /(?:border|border-2)\s+(?:border-)?(?:\[#B1FA63\]|\[#CCFF00\]|lime-400|lime-500|lime-300|emerald-500)/i.test(line) ||
      /border-(?:\[#B1FA63\]|\[#CCFF00\]|lime-400|lime-500|lime-300|emerald-500)(?!\/)/i.test(line);

    const hasHoverGreenTextWhite = /hover:bg-(?:\[#B1FA63\]|\[#CCFF00\]|lime|emerald).*hover:text-white/i.test(line) ||
      (line.includes("hover:border-[#B1FA63]") && line.includes("hover:text-white"));

    const hasButtonGreenOverride = line.includes("hover:border-[#B1FA63]/30 text-white hover:text-white") ||
      line.includes("hover:border-lime-400/50");

    if (isButtonContext && (hasGreenBorder || hasHoverGreenTextWhite || hasButtonGreenOverride || line.includes("border-[#B1FA63]"))) {
      targetLines.push({
        file: relPath,
        lineNum: idx + 1,
        line: line.trim()
      });
    }
  });
});

console.log(`Found ${targetLines.length} candidate button lines:`);
targetLines.forEach(t => console.log(`[${t.file}:${t.lineNum}] ${t.line}`));
