import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "admin"),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@admin": path.resolve(__dirname, "admin/src"),
    },
  },
  server: {
    port: 8082,
    host: true,
  },
  define: {
    "process.env": {},
  },
  build: {
    outDir: path.resolve(__dirname, "dist-admin"),
    emptyOutDir: true,
    target: "esnext",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
