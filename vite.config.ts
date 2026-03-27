import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
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
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        categories: ["business", "productivity"],
        shortcuts: [
          { name: "Dashboard",  short_name: "Home",      url: "/",            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }] },
          { name: "Inventory",  short_name: "Inventory", url: "/inventory",   icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }] },
          { name: "Safety",     short_name: "Safety",    url: "/safety",      icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Cache app shell + assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Network-first for API calls (Supabase), cache-first for assets
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
            },
          },
        ],
        // Offline fallback
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/(api|supabase)/],
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false, // disable SW in dev to avoid caching issues
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
