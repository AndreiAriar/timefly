import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  build: {
    // ✅ Raise the warning limit for large bundles
    chunkSizeWarningLimit: 1500,

    // ✅ Optional optimization: separate large libraries into their own chunks
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          vendor: ["react-router-dom", "axios"]
        }
      }
    }
  }
});
