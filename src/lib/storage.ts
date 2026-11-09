// File storage (PLAN.md §5.1). Signed URLs for the private files come in
// Phase 6.

// Public URL of a preview file from its storage key, such as
// "previews/midnight-drive.mp3". PUBLIC_CDN_URL is the R2 public bucket
// (Phase 5). While it's empty, the URL is "/previews/midnight-drive.mp3",
// which Next serves from public/.
// Call it on the server only: PUBLIC_CDN_URL isn't sent to the browser.
export function previewUrl(key: string) {
  return `${process.env.PUBLIC_CDN_URL ?? ""}/${key}`;
}
