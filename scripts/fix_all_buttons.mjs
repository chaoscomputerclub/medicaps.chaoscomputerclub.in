import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "src");

// 1. Update src/components/ui/button.tsx
const mainButtonPath = path.join(rootDir, "src/components/ui/button.tsx");
let mainButtonCode = fs.readFileSync(mainButtonPath, "utf-8");

mainButtonCode = mainButtonCode.replace(
  'outline:\n          "bg-[#171717] text-white border border-[#B1FA63] hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] shadow-none",',
  'outline:\n          "bg-[#171717] text-white border border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] shadow-none",'
);

mainButtonCode = mainButtonCode.replace(
  'secondary:\n          "bg-[#242424] text-zinc-200 border border-white/10 hover:border-[#B1FA63]/50 hover:text-white shadow-none",',
  'secondary:\n          "bg-[#242424] text-zinc-200 border border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] shadow-none",'
);

mainButtonCode = mainButtonCode.replace(
  'ghost:\n          "bg-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-white border border-transparent",',
  'ghost:\n          "bg-transparent text-zinc-400 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] border border-transparent",'
);

fs.writeFileSync(mainButtonPath, mainButtonCode, "utf-8");
console.log("✅ Updated src/components/ui/button.tsx: no green border by default, hover:bg green with black text.");

// 2. Update src/components/animate-ui/components/buttons/button.tsx
const animButtonPath = path.join(rootDir, "src/components/animate-ui/components/buttons/button.tsx");
let animButtonCode = fs.readFileSync(animButtonPath, "utf-8");

animButtonCode = animButtonCode.replace(
  "outline:\n          'bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors',",
  "outline:\n          'bg-transparent text-white border border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors',"
);

animButtonCode = animButtonCode.replace(
  "secondary:\n          'bg-[#242424] text-zinc-200 border border-white/10 hover:border-[#B1FA63]/50 hover:text-white shadow-none transition-colors duration-150 [&_svg]:transition-colors',",
  "secondary:\n          'bg-[#242424] text-zinc-200 border border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400 shadow-none transition-colors duration-150 [&_svg]:transition-colors',"
);

fs.writeFileSync(animButtonPath, animButtonCode, "utf-8");
console.log("✅ Updated src/components/animate-ui/components/buttons/button.tsx.");

// 3. Scan all TSX/TS files for button overrides
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

const allFiles = walk(srcDir);
let changedCount = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, "utf-8");
  let original = content;

  // Replace buttons with hover:border-[#B1FA63]/30 text-white hover:text-white
  content = content.replaceAll(
    'hover:border-[#B1FA63]/30 text-white hover:text-white',
    'text-white hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63]'
  );

  // Replace buttons with hover:border-[#B1FA63]/30 hover:bg-[#171717] text-zinc-300 hover:text-white
  content = content.replaceAll(
    'hover:border-[#B1FA63]/30 hover:bg-[#171717] text-zinc-300 hover:text-white',
    'text-zinc-300 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63]'
  );

  // Replace buttons with hover:border-[#B1FA63]/30 hover:bg-[#171717]
  content = content.replaceAll(
    'hover:border-[#B1FA63]/30 hover:bg-[#171717]',
    'hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63]'
  );

  // Replace hover:border-lime-400 hover:text-white
  content = content.replaceAll(
    'hover:border-lime-400 hover:text-white',
    'hover:bg-lime-400 hover:text-black hover:border-lime-400'
  );

  // Replace hover:border-lime-400/50 hover:text-white
  content = content.replaceAll(
    'hover:border-lime-400/50 hover:text-white',
    'hover:bg-lime-400 hover:text-black hover:border-lime-400'
  );

  // Replace hover:border-lime-400/50
  content = content.replaceAll(
    'hover:border-lime-400/50',
    'hover:bg-lime-400 hover:text-black hover:border-lime-400'
  );

  // Replace ContestArenaPage custom button styling: bg-black text-zinc-400 border-white/10 hover:border-lime-400 hover:text-white
  content = content.replaceAll(
    'bg-black text-zinc-400 border-white/10 hover:border-lime-400 hover:text-white',
    'bg-[#171717] text-zinc-400 border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63]'
  );

  // Replace PracticePage button:
  // className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-lime-400 border border-lime-400/30 bg-lime-400/10 rounded-md hover:bg-lime-400/20 transition-colors cursor-pointer"
  content = content.replaceAll(
    'text-lime-400 border border-lime-400/30 bg-lime-400/10 rounded-md hover:bg-lime-400/20',
    'text-zinc-200 border border-white/10 bg-[#171717] rounded-md hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63]'
  );

  // Replace ScoreboardMatrix button:
  // className="px-3 py-1.5 rounded-[8px] bg-[#B1FA63]/10 border border-[#B1FA63]/30 hover:bg-[#B1FA63]/20 text-xs font-sans text-[#B1FA63] font-medium transition-colors"
  content = content.replaceAll(
    'bg-[#B1FA63]/10 border border-[#B1FA63]/30 hover:bg-[#B1FA63]/20 text-xs font-sans text-[#B1FA63]',
    'bg-[#171717] border border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] text-xs font-sans text-zinc-300'
  );

  if (content !== original) {
    fs.writeFileSync(file, content, "utf-8");
    changedCount++;
    console.log(`Updated ${path.relative(rootDir, file)}`);
  }
}

console.log(`\n🎉 Completed! Updated ${changedCount} files with clean button styles.`);
