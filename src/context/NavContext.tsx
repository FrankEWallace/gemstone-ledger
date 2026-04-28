import { createContext, useContext, useState, useCallback } from "react";

// Keys matching the sidebar section groups
export type NavSectionKey =
  | "core"
  | "operations"
  | "team"
  | "extensions";

const STORAGE_KEY = "fw-hidden-nav";

function readHidden(): Set<NavSectionKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as NavSectionKey[]);
  } catch {
    return new Set();
  }
}

function writeHidden(hidden: Set<NavSectionKey>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
}

interface NavContextValue {
  hiddenSections: Set<NavSectionKey>;
  toggleSection: (key: NavSectionKey) => void;
  isSectionHidden: (key: NavSectionKey) => boolean;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [hiddenSections, setHiddenSections] = useState<Set<NavSectionKey>>(readHidden);

  const toggleSection = useCallback((key: NavSectionKey) => {
    setHiddenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      writeHidden(next);
      return next;
    });
  }, []);

  const isSectionHidden = useCallback(
    (key: NavSectionKey) => hiddenSections.has(key),
    [hiddenSections]
  );

  return (
    <NavContext.Provider value={{ hiddenSections, toggleSection, isSectionHidden }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}
