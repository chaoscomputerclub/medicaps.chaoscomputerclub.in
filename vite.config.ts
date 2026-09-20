import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
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
    include: ["react", "react-dom", "react-router-dom", "react-redux", "@reduxjs/toolkit"],
  },
  define: {
    "process.env": {},
  },
  build: {
    target: "esnext",
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("/react/") || id.includes("react-router-dom")) {
              return "vendor-react";
            }
            if (id.includes("@reduxjs/toolkit") || id.includes("react-redux")) {
              return "vendor-redux";
            }
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            if (id.includes("@monaco-editor") || id.includes("monaco-editor")) {
              return "vendor-monaco";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            return "vendor-common";
          }
        },
      },
    },
  },
});
