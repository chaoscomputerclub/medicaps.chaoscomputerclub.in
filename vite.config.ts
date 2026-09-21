import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import monacoEditorPlugin from "vite-plugin-monaco-editor";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    // Bundles Monaco workers locally — eliminates 60+ CDN requests and ~28 MB runtime load
    // Only bundle workers for languages actually used in the judge: Python, C++, Java, JS
    // editorWorkerService = core (required). TS worker is 13 MB — not needed for Python/C++/Java
    (monacoEditorPlugin as any).default
      ? (monacoEditorPlugin as any).default({
          languageWorkers: ["editorWorkerService"],
          publicPath: "monacoeditorwork",
          globalAPI: false,
        })
      : (monacoEditorPlugin as any)({
          languageWorkers: ["editorWorkerService"],
          publicPath: "monacoeditorwork",
          globalAPI: false,
        }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 8081,
    host: true,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "react-redux",
      "@reduxjs/toolkit",
      "@monaco-editor/react",
      "monaco-editor",
    ],
  },
  define: {
    "process.env": {},
  },
  build: {
    target: "esnext",
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    // Smart modulepreload: preload core vendor chunks (React, Redux, Radix, common) for instantaneous boot,
    // but filter out heavy non-initial chunks (vendor-monaco, non-active route pages)
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_filename, deps) => {
        return deps.filter(
          (dep) =>
            !dep.includes("vendor-monaco") &&
            !dep.includes("vendor-charts") &&
            !dep.includes("Page-")
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // React core — always needed, split first
            if (
              id.includes("react-dom") ||
              id.includes("/react/") ||
              id.includes("react-router-dom")
            ) {
              return "vendor-react";
            }
            // State management
            if (id.includes("@reduxjs/toolkit") || id.includes("react-redux")) {
              return "vendor-redux";
            }
            // Radix UI primitives
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            // Monaco — workers are in public/monacoeditorwork, runtime wrapper is tiny
            if (id.includes("@monaco-editor") || id.includes("monaco-editor")) {
              return "vendor-monaco";
            }
            // Icons
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            // Charts — only used on Profile + Dashboard, lazy loaded
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-")) {
              return "vendor-charts";
            }
            // QR code — only used on CampusPassCard
            if (id.includes("qrcode")) {
              return "vendor-qr";
            }
            // Date handling
            if (id.includes("date-fns")) {
              return "vendor-dates";
            }
            // Everything else
            return "vendor-common";
          }
        },
      },
    },
  },
});
