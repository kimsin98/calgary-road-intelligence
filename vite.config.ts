import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/maplibre-gl")) return "maplibre";
          if (id.includes("node_modules/react")) return "react-vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["devbox"],
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: ["devbox"],
  },
});
