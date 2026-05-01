import { useState, useEffect, useCallback } from "react";

export type FontKey = "nunito-sans" | "figtree" | "inter" | "geist";

export const FONT_OPTIONS: { key: FontKey; label: string; sample: string }[] = [
  { key: "nunito-sans", label: "Nunito Sans", sample: "Aa" },
  { key: "figtree",     label: "Figtree",     sample: "Aa" },
  { key: "inter",       label: "Inter",       sample: "Aa" },
  { key: "geist",       label: "Geist",       sample: "Aa" },
];

const STORAGE_KEY = "gemstone-font";
const DEFAULT_FONT: FontKey = "nunito-sans";

function applyFont(key: FontKey) {
  document.documentElement.setAttribute("data-font", key);
}

export function useFontPreference() {
  const [font, setFontState] = useState<FontKey>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as FontKey | null;
    return saved ?? DEFAULT_FONT;
  });

  useEffect(() => {
    applyFont(font);
  }, [font]);

  const setFont = useCallback((key: FontKey) => {
    setFontState(key);
    localStorage.setItem(STORAGE_KEY, key);
    applyFont(key);
  }, []);

  return { font, setFont, options: FONT_OPTIONS };
}

export function initFontPreference() {
  const saved = localStorage.getItem(STORAGE_KEY) as FontKey | null;
  if (saved) applyFont(saved);
}
