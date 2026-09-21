/**
 * Chaos Computer Club India — Monaco Code Editor Component
 *
 * Uses @monaco-editor/react with locally bundled workers (vite-plugin-monaco-editor).
 * Zero CDN requests. Zero runtime script injection. Workers served from /monacoeditorwork/.
 */

import { memo, useRef, useCallback } from "react";
import Editor, { type OnMount, type OnChange, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Wire Monaco to use locally bundled worker from vite-plugin-monaco-editor
if (typeof window !== "undefined") {
  (window as any).MonacoEnvironment = {
    getWorkerUrl: function (_moduleId: any, _label: string) {
      return "/monacoeditorwork/editor.worker.bundle.js";
    },
  };
}

loader.config({ monaco });

const LANG_TO_MONACO: Record<string, string> = {
  python: "python",
  cpp: "cpp",
  c: "c",
  java: "java",
  javascript: "javascript",
  typescript: "typescript",
};

// The CCC dark theme definition — identical to the original
const CCC_DARK_THEME = {
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
};

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (val: string) => void;
  height?: string | number;
}

export const MonacoEditor = memo(function MonacoEditor({
  value,
  language,
  onChange,
  height = "100%",
}: MonacoEditorProps) {
  const monacoRef = useRef<any>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;
    // Register the CCC dark theme once on mount
    monaco.editor.defineTheme("ccc-dark", CCC_DARK_THEME);
    monaco.editor.setTheme("ccc-dark");
  }, []);

  const handleChange: OnChange = useCallback(
    (val) => {
      onChange?.(val ?? "");
    },
    [onChange]
  );

  const monacoLanguage = LANG_TO_MONACO[language] ?? "python";

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden">
      <Editor
        height={height}
        language={monacoLanguage}
        value={value}
        theme="vs-dark"
        onChange={handleChange}
        onMount={handleMount}
        loading={
          <div className="p-4 text-xs font-mono text-zinc-500 animate-pulse">
            Initializing terminal code editor…
          </div>
        }
        options={{
          fontSize: 13,
          fontFamily: '"Geist Mono", "JetBrains Mono", Consolas, monospace',
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          renderLineHighlight: "gutter",
          padding: { top: 12, bottom: 12 },
          tabSize: 4,
          wordWrap: "on",
          automaticLayout: true,
          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
          overviewRulerLanes: 0,
          renderWhitespace: "none",
          contextmenu: true,
          folding: true,
        }}
      />
    </div>
  );
});

export default MonacoEditor;
