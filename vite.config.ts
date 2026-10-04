import { existsSync, unlinkSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "compressed-snapshot-output",
      closeBundle() {
        if(existsSync("dist/data/annual-replays")) for(const name of readdirSync("dist/data/annual-replays")) {if(name.endsWith(".json")&&name!=="index.json")unlinkSync("dist/data/annual-replays/"+name)}
        /* public files are copied before closeBundle */
        for (const name of ["dataset", "weather", "forecast-annual", "forecast-eb30"]) {
          const file = "dist/data/" + name + ".json";
          if (existsSync(file)) unlinkSync(file);
        }
      },
    },
  ],
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
