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
    } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(srcDir);
const list = [];

files.forEach(file => {
  const content = fs.readFileSync(file, "utf-8");
  const relPath = path.relative(rootDir, file);

  // Match tags like <button, <Button, or className on buttons
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line or surrounding lines define a button with green border or hover green
    if (
      line.includes("border-[#B1FA63]") ||
      line.includes("border-lime") ||
      line.includes("border-[#CCFF00]") ||
      line.includes("border-emerald") ||
      line.includes("hover:bg-[#B1FA63]") ||
      line.includes("hover:bg-lime") ||
      line.includes("hover:bg-[#CCFF00]")
    ) {
      list.push({
        file: relPath,
        lineNum: i + 1,
        code: line.trim()
      });
    }
  }
});

console.log(`Found ${list.length} occurrences:`);
list.forEach(item => {
  console.log(`[${item.file}:${item.lineNum}] ${item.code}`);
});
