import { BrowserRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NavProvider } from "@/context/NavContext";
import Router from "@/app/Router";
import { queryPersister } from "@/lib/offline/persister";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      // Allow cached (possibly stale) data to be shown immediately while
      // a background refetch happens — critical for offline-first UX.
      gcTime: 24 * 60 * 60 * 1000, // keep unused cache for 24 h
    },
  },
});

export default function App() {
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
