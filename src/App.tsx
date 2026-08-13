import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/context/ThemeContext";
import { NavProvider } from "@/context/NavContext";
import Router from "@/app/Router";
import { queryPersister } from "@/lib/offline/persister";
import { initSyncEngine } from "@/lib/offline/syncEngine";

// Import services so their registerHandler() calls run at module load
import "@/services/safety.service";
import "@/services/transactions.service";
import "@/services/inventory.service";
import "@/services/production.service";

export default function App() {
  useEffect(() => {
    const cleanup = initSyncEngine();
    return cleanup;
  }, []);

  // Keep every client on the freshly-deployed bundle.
  //
  // The SW (sw.ts) calls skipWaiting()+clients.claim(), so a new version takes
  // control as soon as it installs and fires `controllerchange` — we reload
  // there to swap the running JS. But the browser only *checks* for a new SW on
  // a hard navigation or roughly every 24 h. This is an SPA whose installed PWA
  // opens to /capture and then moves via client-side routing, so it can stay
  // open for hours and never trigger that check — leaving users on stale code.
  // So we poll registration.update() proactively (on tab focus and a timer),
  // which is a cheap conditional GET that kicks off the install→reload flow.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return; // guard against a double reload
      refreshing = true;
      console.info("[App] New SW version active — reloading for fresh bundle");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    let registration: ServiceWorkerRegistration | undefined;
    const checkForUpdate = () => {
      registration?.update().catch(() => {
        /* offline or transient — the next check will retry */
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      registration = reg;
      checkForUpdate(); // check once on load
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Safety net for a tab left focused for a long stretch.
    const interval = window.setInterval(checkForUpdate, 15 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        // Serialised cache older than 24 h is discarded on load
        maxAge: 24 * 60 * 60 * 1000,
      }}
    >
      <ThemeProvider>
      <NavProvider>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
      </NavProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  );
}
