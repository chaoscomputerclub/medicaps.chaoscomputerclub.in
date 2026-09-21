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

// Authentic VS Code Dark+ theme definition
const VSCODE_DARK_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "6a9955", fontStyle: "italic" },
    { token: "keyword", foreground: "569cd6" },
    { token: "keyword.control", foreground: "c586c0" },
    { token: "identifier", foreground: "9cdcfe" },
    { token: "string", foreground: "ce9178" },
    { token: "number", foreground: "b5cea8" },
    { token: "type", foreground: "4ec9b0" },
    { token: "function", foreground: "dcdcaa" },
    { token: "delimiter", foreground: "d4d4d4" },
    { token: "operator", foreground: "d4d4d4" },
  ],
  colors: {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
    "editorCursor.foreground": "#aeafad",
    "editor.lineHighlightBackground": "#282828",
    "editorLineNumber.foreground": "#858585",
    "editorLineNumber.activeForeground": "#c6c6c6",
    "editor.selectionBackground": "#264f78",
    "editor.inactiveSelectionBackground": "#3a3d41",
    "editorGutter.background": "#1e1e1e",
    "editorIndentGuide.background1": "#404040",
    "editorIndentGuide.activeBackground1": "#707070",
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
    // Register the authentic VS Code dark theme on mount
    monaco.editor.defineTheme("vscode-dark-plus", VSCODE_DARK_THEME);
    monaco.editor.setTheme("vscode-dark-plus");

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
    <div className="relative w-full h-full bg-[#1e1e1e] overflow-hidden">
      <Editor
        height={height}
        language={monacoLanguage}
        value={value}
        theme="vs-dark"
        onChange={handleChange}
        onMount={handleMount}
        loading={
          <div className="p-4 text-xs font-mono text-zinc-500 animate-pulse">
            Initializing VS Code editor…
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
          renderLineHighlight: "all",
          renderLineHighlightOnlyWhenFocus: false,
          padding: { top: 12, bottom: 12 },
          tabSize,
          wordWrap,
          automaticLayout: true,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, useShadows: false },
          overviewRulerLanes: 0,
          renderWhitespace: "none",
          contextmenu: true,
          folding: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          roundedSelection: false,
          smoothScrolling: true,
        }}
      />
    </div>
  );
});

export default MonacoEditor;
