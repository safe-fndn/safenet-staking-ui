/**
 * Content types stored in the manifest, and served by gateways, per file
 * extension: the types this app's build produces, plus `txt` for files like
 * robots.txt and .well-known/security.txt. Browsers refuse module scripts and
 * stylesheets served with the wrong type, so any other extension is an error
 * rather than a guess; add it here when the build starts producing it.
 */
const TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/vnd.microsoft.icon",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
}

export function contentTypeFor(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1)
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : ""
  if (!Object.hasOwn(TYPES, ext)) throw new Error(`no content type for ${path}; add its extension to scripts/swarm/content-type.ts`)
  return TYPES[ext]
}
