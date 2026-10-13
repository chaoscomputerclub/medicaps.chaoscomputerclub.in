#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

// Parse CLI options
const args = process.argv.slice(2);
const isApply = args.includes("--apply");

function getArgValue(name, defaultValue) {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}

const fromFont = getArgValue("--from", "font-mono");
const toFont = getArgValue("--to", "font-sans");
const targetDirInput = getArgValue("--dir", "src");
const targetDir = path.resolve(process.cwd(), targetDirInput);

const extensions = new Set([".tsx", ".ts", ".jsx", ".js", ".html"]);
const fontRegex = new RegExp(`\\b${fromFont}\\b`, "g");

let totalMatches = 0;
const matchedFiles = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      if (entry.name === "styles.css") continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      const matches = content.match(fontRegex);
      if (matches) {
        totalMatches += matches.length;
        matchedFiles.push({ path: fullPath, count: matches.length, content });
      }
    }
  }
}

walk(targetDir);

console.log("=".repeat(65));
console.log(`🔍 FONT STYLE REPLACEMENT: '${fromFont}' -> '${toFont}'`);
console.log(`📁 Target Directory: ${targetDir}`);
console.log(`📊 Found ${totalMatches} occurrences across ${matchedFiles.length} files`);
console.log("=".repeat(65));

if (matchedFiles.length === 0) {
  console.log(`✨ No files contain the font class '${fromFont}'. Everything is clean!\n`);
  process.exit(0);
}

if (!isApply) {
  console.log("\n[DRY RUN PREVIEW - No files were modified]");
  for (const file of matchedFiles) {
    console.log(`  • ${path.relative(process.cwd(), file.path)} (${file.count} matches)`);
  }
  console.log("\n👉 To apply changes at once across all files, run:");
  console.log(`   node scripts/replace-font-style.mjs --from ${fromFont} --to ${toFont} --apply\n`);
} else {
  for (const file of matchedFiles) {
    const updated = file.content.replace(fontRegex, toFont);
    fs.writeFileSync(file.path, updated, "utf-8");
    console.log(`  ✔ Updated: ${path.relative(process.cwd(), file.path)} (${file.count} replaced)`);
  }
  console.log("=".repeat(65));
  console.log(`✅ Success! Replaced ${totalMatches} occurrences in ${matchedFiles.length} files.`);
  console.log("=".repeat(65));
}
