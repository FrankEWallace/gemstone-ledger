// Only follow same-origin redirects; "?redirect=https://evil.example" (or
// "//evil.example", "/\evil.example") would otherwise bounce a freshly
// signed-in user to a lookalike site.
export function safeRedirect(raw: string | null): string {
  if (!raw) return "/";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
