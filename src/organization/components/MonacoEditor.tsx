/**
 * Chaos Computer Club India — Monaco Code Editor Component
 * Inspired by Interleet Monaco Editor
 */

import { useEffect, useRef, memo, useState } from "react";

const LANG_TO_MONACO: Record<string, string> = {
  python: "python",
  cpp: "cpp",
  javascript: "javascript",
  java: "java",
};

declare global {
  interface Window {
    __monacoReady?: boolean;
    monaco?: any;
    require?: any;
  }
}

function loadMonaco(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (window.__monacoReady && window.monaco) {
      resolve(window.monaco);
      return;
    }
    const existing = document.getElementById("monaco-loader-script");
    if (existing) {
      const interval = setInterval(() => {
        if (window.__monacoReady && window.monaco) {
          clearInterval(interval);
          resolve(window.monaco);
        }
      }, 50);
      return;
    }
    const s = document.createElement("script");
    s.id = "monaco-loader-script";
    s.src = "https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/loader.js";
    s.onload = () => {
      window.require.config({
        paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs" },
      });
      window.require(["vs/editor/editor.main"], (monaco: any) => {
        window.monaco = monaco;
        window.__monacoReady = true;
        resolve(monaco);
      });
    };
    document.head.appendChild(s);
  });
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const subRef = useRef<any>(null);
  const prevLang = useRef(language);
  const [loaded, setLoaded] = useState(false);

  const valueRef = useRef(value);
  valueRef.current = value;
  const languageRef = useRef(language);
  languageRef.current = language;

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let alive = true;

    loadMonaco().then((monaco) => {
      if (!alive || !containerRef.current || editorRef.current) return;

      // Register authentic Chaos Computer Club dark theme
      monaco.editor.defineTheme("ccc-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "8f918d", fontStyle: "italic" },
          { token: "keyword", foreground: "c8ff36", fontStyle: "bold" },
          { token: "identifier", foreground: "eeede5" },
          { token: "string", foreground: "64d8db" },
          { token: "number", foreground: "ffb84d" },
          { token: "type", foreground: "ffffff" },
          { token: "delimiter", foreground: "8f918d" },
        ],
        colors: {
          "editor.background": "#09090b",
          "editor.foreground": "#eeede5",
          "editorCursor.foreground": "#f97316",
          "editor.lineHighlightBackground": "#18181b",
          "editorLineNumber.foreground": "#52525b",
          "editorLineNumber.activeForeground": "#f97316",
          "editor.selectionBackground": "#27272a",
          "editor.inactiveSelectionBackground": "#18181b",
          "editorGutter.background": "#09090b",
          "editorIndentGuide.background1": "#18181b",
          "editorIndentGuide.activeBackground1": "#27272a",
        },
      });

      const editor = monaco.editor.create(containerRef.current, {
        value: valueRef.current,
        language: LANG_TO_MONACO[languageRef.current] ?? "python",
        theme: "ccc-dark",
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
      });

      editorRef.current = editor;
      setLoaded(true);

      subRef.current = editor.onDidChangeModelContent(() => {
        onChangeRef.current?.(editor.getValue());
      });

      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, LANG_TO_MONACO[languageRef.current] ?? "python");
        if (model.getValue() !== valueRef.current) {
          model.setValue(valueRef.current || "");
        }
      }
    });

    return () => {
      alive = false;
      subRef.current?.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!editorRef.current || !window.monaco) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    window.monaco.editor.setModelLanguage(model, LANG_TO_MONACO[language] ?? "python");
    if (prevLang.current !== language || model.getValue() !== value) {
      model.setValue(value || "");
      prevLang.current = language;
    }
  }, [language, value]);

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden">
      {!loaded && (
        <div className="p-4 text-xs font-mono text-zinc-500 animate-pulse">
          Initializing terminal code editor…
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
});

export default MonacoEditor;
