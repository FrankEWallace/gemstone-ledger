/// <reference lib="WebWorker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import {
  StaleWhileRevalidate,
  CacheFirst,
  NetworkFirst,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

// ─── Precache (manifest injected by vite-plugin-pwa) ─────────────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── Runtime caching ──────────────────────────────────────────────────────────

// Supabase auth — NetworkFirst, short timeout
registerRoute(
  ({ url }) => url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/auth/"),
  new NetworkFirst({
    cacheName: "supabase-auth",
    networkTimeoutSeconds: 8,
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 })],
  })
);

// Supabase storage (images, docs) — CacheFirst, long TTL
registerRoute(
  ({ url }) => url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/storage/"),
  new CacheFirst({
    cacheName: "supabase-storage",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  })
);

// Supabase data API — StaleWhileRevalidate (shows cached data instantly)
registerRoute(
  ({ url }) => url.hostname.endsWith(".supabase.co"),
  new StaleWhileRevalidate({
    cacheName: "supabase-api",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 15 * 60 })],
  })
);

// Google Fonts — CacheFirst, very long TTL
registerRoute(
  ({ url }) => ["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname),
  new CacheFirst({
    cacheName: "google-fonts",
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  })
);

// SPA navigation fallback — serve app shell for all nav requests
registerRoute(
  new NavigationRoute(
    new CacheFirst({ cacheName: "app-shell" }),
    { denylist: [/^\/(api|supabase)/] }
  )
);

// ─── Service Worker lifecycle ─────────────────────────────────────────────────
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(self.clients.claim())
);

// ─── Auth cache invalidation ──────────────────────────────────────────────────
// The app posts CLEAR_SUPABASE_CACHE on sign-out and on user-switch so that
// the next session never sees cached API responses from the previous user.
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_SUPABASE_CACHE") {
    event.waitUntil(
      Promise.all([
        caches.delete("supabase-api"),
        caches.delete("supabase-auth"),
      ]).then(() => {
        console.info("[SW] Supabase caches cleared on auth change");
      })
    );
  }
});

// ─── Background Sync ──────────────────────────────────────────────────────────
// When the browser fires a sync event (device back online, even with tab closed),
// we notify all active window clients to drain their queue via the syncEngine.
// The SW itself doesn't touch Dexie or services — it simply wakes up the app.

self.addEventListener("sync", (event) => {
  if ((event as SyncEvent).tag === "fw-mining-sync") {
    (event as SyncEvent).waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync(): Promise<void> {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  if (clients.length > 0) {
    for (const client of clients) {
      client.postMessage({ type: "SW_SYNC_REQUESTED" });
    }
  } else {
    // No active clients — the browser may have woken us up in the background.
    // Nothing to do here; the app will drain on next load via initSyncEngine().
    console.info("[SW] sync event fired but no active clients — will drain on next app open");
  }
}

// Extend SW type for Background Sync
interface SyncEvent extends ExtendableEvent {
  tag: string;
}
