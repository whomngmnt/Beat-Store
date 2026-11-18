// The first thing a keyboard user reaches with Tab: it jumps past the
// header to the page's <main id="main">. Hidden until it has focus.
// Used by the store layout and the admin layout.
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-background px-3 py-2 ring-2 ring-ring focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to content
    </a>
  );
}
