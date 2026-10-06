// Only allow same-origin relative paths as post-login redirect targets, so
// ?next=//evil.com or /\evil.com can't bounce users off-site.
export function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}
