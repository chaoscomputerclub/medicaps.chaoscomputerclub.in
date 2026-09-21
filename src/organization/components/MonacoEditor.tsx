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

// The CCC dark theme definition — pure pitch black with Electric Lime accents
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
  onCursorChange?: (line: number, col: number) => void;
  height?: string | number;
  fontSize?: number;
  wordWrap?: "on" | "off";
  tabSize?: number;
}

export const MonacoEditor = memo(function MonacoEditor({
  value,
  language,
  onChange,
  onCursorChange,
  height = "100%",
  fontSize = 13.5,
  wordWrap = "on",
  tabSize = 4,
}: MonacoEditorProps) {
  const monacoRef = useRef<any>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;
    // Register the original CCC dark theme on mount
    monaco.editor.defineTheme("ccc-dark", CCC_DARK_THEME);
    monaco.editor.setTheme("ccc-dark");

    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.(e.position.lineNumber, e.position.column);
    });
  }, [onCursorChange]);

  const handleChange: OnChange = useCallback(
    (val) => {
      onChange?.(val ?? "");
    },
    [onChange]
  );

  const monacoLanguage = LANG_TO_MONACO[language] ?? "python";

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
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
          fontSize,
          fontFamily: "'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace",
          fontLigatures: false,
          lineHeight: 21,
          letterSpacing: 0,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          cursorStyle: "line",
          cursorWidth: 2,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          renderLineHighlight: "gutter",
          padding: { top: 12, bottom: 12 },
          tabSize,
          wordWrap,
          automaticLayout: true,
          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
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
