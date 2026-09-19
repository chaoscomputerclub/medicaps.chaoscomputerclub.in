import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
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
    chunkSizeWarningLimit: 1200,
  },
});
