import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

// 1. Update MonacoEditor.tsx
const monacoEditorPath = path.join(rootDir, "src/organization/components/MonacoEditor.tsx");
let monacoContent = fs.readFileSync(monacoEditorPath, "utf-8");

const oldCccTheme = `const CCC_DARK_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "52525b", fontStyle: "italic" },
    { token: "keyword", foreground: "CCFF00", fontStyle: "bold" },
    { token: "identifier", foreground: "f4f4f5" },
    { token: "string", foreground: "a1a1aa" },
    { token: "number", foreground: "CCFF00" },
    { token: "type", foreground: "ffffff" },
    { token: "delimiter", foreground: "71717a" },
  ],
  colors: {
    "editor.background": "#000000",
    "editor.foreground": "#f4f4f5",
    "editorCursor.foreground": "#CCFF00",
    "editor.lineHighlightBackground": "#0a0a0a",
    "editorLineNumber.foreground": "#3f3f46",
    "editorLineNumber.activeForeground": "#CCFF00",
    "editor.selectionBackground": "#1f1f1f",
    "editor.inactiveSelectionBackground": "#121212",
    "editorGutter.background": "#000000",
    "editorIndentGuide.background1": "#141414",
    "editorIndentGuide.activeBackground1": "#242424",
  },
};`;

const newCccTheme = `const CCC_DARK_THEME: monaco.editor.IStandaloneThemeData = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "666666", fontStyle: "italic" },
    { token: "keyword", foreground: "B1FA63", fontStyle: "bold" },
    { token: "identifier", foreground: "f4f4f5" },
    { token: "string", foreground: "a1a1aa" },
    { token: "number", foreground: "B1FA63" },
    { token: "type", foreground: "ffffff" },
    { token: "delimiter", foreground: "71717a" },
  ],
  colors: {
    "editor.background": "#171717",
    "editor.foreground": "#f4f4f5",
    "editorCursor.foreground": "#B1FA63",
    "editor.lineHighlightBackground": "#1e1e1e",
    "editorLineNumber.foreground": "#52525b",
    "editorLineNumber.activeForeground": "#B1FA63",
    "editor.selectionBackground": "#2e2e2e",
    "editor.inactiveSelectionBackground": "#242424",
    "editorGutter.background": "#171717",
    "editorIndentGuide.background1": "#242424",
    "editorIndentGuide.activeBackground1": "#333333",
  },
};

// Register CCC dark theme upfront so Monaco initializes with #171717 application background immediately
try {
  monaco.editor.defineTheme("ccc-dark", CCC_DARK_THEME);
} catch {
  // Ignore in non-browser or worker contexts
}`;

monacoContent = monacoContent.replace(oldCccTheme, newCccTheme);
monacoContent = monacoContent.replace(
  '<div className="relative w-full h-full bg-black overflow-hidden">',
  '<div className="relative w-full h-full bg-[#171717] overflow-hidden">'
);
monacoContent = monacoContent.replace('theme="vs-dark"', 'theme="ccc-dark"');
monacoContent = monacoContent.replace(
  'onMount={handleMount}',
  'beforeMount={(mon) => mon.editor.defineTheme("ccc-dark", CCC_DARK_THEME)}\n        onMount={handleMount}'
);
monacoContent = monacoContent.replace(
  '<div className="p-4 text-xs font-mono text-zinc-500 animate-pulse">',
  '<div className="p-4 text-xs font-mono text-zinc-500 animate-pulse bg-[#171717]">'
);

fs.writeFileSync(monacoEditorPath, monacoContent, "utf-8");
console.log("Updated MonacoEditor.tsx with #171717 application background.");

// 2. Update ContestArenaPage.tsx
const contestArenaPath = path.join(rootDir, "src/pages/ContestArenaPage.tsx");
let arenaContent = fs.readFileSync(contestArenaPath, "utf-8");
arenaContent = arenaContent.replace(
  '<div className="flex-1 relative overflow-hidden bg-black min-h-0">',
  '<div className="flex-1 relative overflow-hidden bg-[#171717] min-h-0">'
);
fs.writeFileSync(contestArenaPath, arenaContent, "utf-8");
console.log("Updated ContestArenaPage.tsx editor container to bg-[#171717].");

// 3. Update AssessmentWorkspacePage.tsx
const assessmentPath = path.join(rootDir, "src/pages/AssessmentWorkspacePage.tsx");
let assessmentContent = fs.readFileSync(assessmentPath, "utf-8");
assessmentContent = assessmentContent.replace(
  '<div className="w-1/2 flex flex-col bg-black">',
  '<div className="w-1/2 flex flex-col bg-[#171717]">'
);
assessmentContent = assessmentContent.replace(
  '<div className="flex-1 relative overflow-hidden bg-black">',
  '<div className="flex-1 relative overflow-hidden bg-[#171717]">'
);
assessmentContent = assessmentContent.replace(
  '<div className="h-56 flex flex-col border-t border-white/8 bg-black">',
  '<div className="h-56 flex flex-col border-t border-white/8 bg-[#171717]">'
);
fs.writeFileSync(assessmentPath, assessmentContent, "utf-8");
console.log("Updated AssessmentWorkspacePage.tsx editor containers to bg-[#171717].");

// 4. Update src/styles.css
const stylesPath = path.join(rootDir, "src/styles.css");
let stylesContent = fs.readFileSync(stylesPath, "utf-8");
const monacoRule = `
/* Monaco Editor Application Background Synchronization (#171717) */
.monaco-editor,
.monaco-editor .margin,
.monaco-editor-background {
  background-color: #171717 !important;
}
`;
if (!stylesContent.includes("Monaco Editor Application Background Synchronization")) {
  stylesContent += monacoRule;
  fs.writeFileSync(stylesPath, stylesContent, "utf-8");
  console.log("Updated src/styles.css with Monaco background synchronization rule.");
}

console.log("✨ All Monaco editor surfaces synchronized to #171717 in one move!");
