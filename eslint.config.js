import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// Raw Tailwind palette classes (e.g. bg-emerald-100, text-red-500) are banned
// outside components/ui. Use semantic tokens (success/warning/destructive/info)
// or the status registry + StatusBadge instead; decorative accents use chart-1..10.
const PALETTE_RE =
  "(bg|text|border|ring|ring-offset|from|via|to|fill|stroke|divide|outline|decoration|placeholder|caret|accent|shadow)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(50|[1-9]00|950)";
const PALETTE_MESSAGE =
  "Raw Tailwind palette class is banned here. Use a semantic token (success/warning/destructive/info/muted), the status registry + StatusBadge, or a chart-1..10 accent.";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Ban raw palette classes everywhere except the shadcn primitives in ui/.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${PALETTE_RE}/]`, message: PALETTE_MESSAGE },
        { selector: `TemplateElement[value.raw=/${PALETTE_RE}/]`, message: PALETTE_MESSAGE },
      ],
    },
  },
);
