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
const CCC_DARK_THEME: monaco.editor.IStandaloneThemeData = {
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
}

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
    <div className="relative w-full h-full bg-[#171717] overflow-hidden">
      <Editor
        height={height}
        language={monacoLanguage}
        value={value}
        theme="ccc-dark"
        onChange={handleChange}
        beforeMount={(mon) => mon.editor.defineTheme("ccc-dark", CCC_DARK_THEME)}
        onMount={handleMount}
        loading={
          <div className="p-4 text-xs font-sans text-zinc-500 animate-pulse">
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
