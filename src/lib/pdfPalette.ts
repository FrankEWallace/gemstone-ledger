/**
 * Colors for react-pdf exports. PDFs can't read CSS variables, so these mirror
 * the light-theme tokens in src/index.css — change both together.
 */
export const PDF = {
  soot: "#1c1917", // header/footer bands, table headers
  ink: "#0c0a09", // primary text
  body: "#44403c", // table cells
  muted: "#78716c", // labels, captions
  onDark: "#fafaf9", // text on soot
  onDarkMuted: "#a8a29e", // secondary text on soot
  border: "#e8e6e5",
  zebra: "#f4f2f0",
  surface: "#fafaf9",
  paper: "#ffffff",
  income: "#2e8b62", // --chart-1
  expense: "#c0492c", // --chart-2
} as const;
