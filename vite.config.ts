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
    proxy: {
      "/api": {
        target: "https://medicaps.chaoscomputerclub.in",
        changeOrigin: true,
        secure: false,
      },
    },
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
          // Vite runtime helpers (e.g. \0vite/preload-helper) MUST be in vendor-common,
          // never attached to heavy lazy chunks like vendor-monaco
          if (id.includes("preload-helper") || id.includes("vite/") || id.includes("\0vite")) {
            return "vendor-common";
          }

          if (id.includes("node_modules")) {
            // React core — strictly React, React-DOM, React-Router, React-Is, Scheduler
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/react-router/") ||
              id.includes("/node_modules/react-router-dom/") ||
              id.includes("/node_modules/react-is/") ||
              id.includes("/node_modules/scheduler/")
            ) {
              return "vendor-react";
            }
            // Monaco — only Monaco editor runtime & wrappers
            if (id.includes("monaco") || id.includes("@monaco-editor")) {
              return "vendor-monaco";
            }
            // QR code — only used on CampusPassCard
            if (id.includes("qrcode") || id.includes("html5-qrcode")) {
              return "vendor-qr";
            }
            // Date handling
            if (id.includes("date-fns")) {
              return "vendor-dates";
            }
            // State management
            if (id.includes("@reduxjs/toolkit") || id.includes("react-redux")) {
              return "vendor-redux";
            }
            // Radix UI primitives
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            // Icons
            if (id.includes("lucide-react") || id.includes("@phosphor-icons")) {
              return "vendor-icons";
            }
            // Everything else
            return "vendor-common";
          }
        },
      },
    },
  },
});
