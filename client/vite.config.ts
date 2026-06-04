import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3456",
      "/ws": {
        target: "ws://localhost:3456",
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/zustand/")) {
            return "vendor";
          }
          if (id.includes("node_modules/marked/") || id.includes("node_modules/highlight.js/")) {
            return "editor";
          }
          if (id.includes("node_modules/allotment/") || id.includes("node_modules/@tanstack/react-virtual/")) {
            return "layout";
          }
          if (id.includes("node_modules/lucide-react/")) {
            return "icons";
          }
        },
      },
    },
  },
});
