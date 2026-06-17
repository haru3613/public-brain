// Prefix an internal path with the site's base path so links work whether the
// site is served at root (Vercel / custom domain) or under a subpath
// (GitHub Pages project site, e.g. /public-brain/). Pass logical paths like
// "/writing"; never hard-code the base into hrefs.
const BASE = import.meta.env.BASE_URL; // "/" or "/public-brain/"

export function withBase(path = '/'): string {
  const root = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${root}${p}` || '/';
}

/** Normalize a pathname for comparison (drop trailing slash except for root). */
export function normalizePath(p: string): string {
  return p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p;
}
