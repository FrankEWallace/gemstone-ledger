import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Build stamp — surfaced on the capture "More" page so support can tell which
  // deploy a client is actually running (see the service-worker caching history).
  // Also guarantees each production build differs, so the SW update check fires.
  define: {
    __BUILD_ID__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    ),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // injectManifest: use our custom sw.ts so we can handle Background Sync
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "FW Mining OS",
        short_name: "Mining OS",
        description: "Mining Operations Management System by FW",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        // The installed app opens straight into the simplified mobile capture.
        // The full dashboard stays reachable in-app via the "Full app" link.
        start_url: "/capture",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        categories: ["business", "productivity"],
        shortcuts: [
          { name: "New entry", short_name: "New entry", url: "/capture?new=1",    icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }] },
          { name: "Prices",    short_name: "Prices",    url: "/capture/prices",   icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }] },
          { name: "Full app",  short_name: "Full app",  url: "/",                 icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }] },
        ],
      },
      injectManifest: {
        // Precache all built assets...
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // ...except the heavy, export-only chunks. react-pdf (~1.6 MB) and
        // xlsx (~430 KB) are only pulled in via dynamic import() when a user
        // exports a PDF/spreadsheet. Precaching them forces every installed
        // PWA to download ~2 MB on each service-worker update for features
        // most sessions never touch. They are instead fetched on demand and
        // runtime-cached (CacheFirst) by sw.ts the first time they are used.
        globIgnores: ["**/react-pdf.browser-*.js", "**/xlsx-*.js"],
      },
      devOptions: {
        enabled: false, // disable SW in dev to avoid caching issues
        type: "module",
      },
    }),
  ].filter(Boolean),
  build: {
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
