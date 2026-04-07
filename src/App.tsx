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

  // After a deployment the Service Worker activates the new version and fires
  // controllerchange. Reloading here ensures users always run the latest bundle
  // rather than old JS against a potentially-updated backend or API contract.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handleControllerChange = () => {
      console.info("[App] New SW version active — reloading for fresh bundle");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
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
