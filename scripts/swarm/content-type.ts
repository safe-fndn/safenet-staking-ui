/**
 * Content types stored in the manifest, and served by gateways, per file
 * extension. Browsers refuse module scripts and stylesheets served with the
 * wrong type, so every extension a web build produces must be listed here.
 * Unknown extensions get `application/octet-stream`.
 */
const TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  webmanifest: "application/manifest+json",
  map: "application/json",
  txt: "text/plain; charset=utf-8",
  xml: "text/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/vnd.microsoft.icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  wasm: "application/wasm",
  pdf: "application/pdf",
}

export function contentTypeFor(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1)
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : ""
  return Object.hasOwn(TYPES, ext) ? TYPES[ext] : "application/octet-stream"
}
