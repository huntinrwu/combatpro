// Lowercase, dash-separated name for Content-Disposition filenames.
export function fileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-");
}
