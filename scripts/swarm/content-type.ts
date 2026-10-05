/**
 * Content types as assigned by Bee to files inside an uploaded tar collection.
 *
 * Bee (pkg/api/dirs.go) uses Go's `mime.TypeByExtension(filepath.Ext(name))`.
 * This is a frozen copy of Go 1.26's built-in table (src/mime/type.go,
 * `builtinTypesLower`), which is what the official Bee v2.8.1 Docker image
 * uses: it ships neither /etc/mime.types nor /usr/share/mime/globs2, so no
 * OS-level mime database extends or overrides it.
 *
 * Unknown extensions map to "" — Bee still stores `"Content-Type":""`.
 */
const GO_BUILTIN_MIME_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".ai": "application/postscript",
  ".apk": "application/vnd.android.package-archive",
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".bin": "application/octet-stream",
  ".bmp": "image/bmp",
  ".com": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ehtml": "text/html; charset=utf-8",
  ".eml": "message/rfc822",
  ".eps": "application/postscript",
  ".exe": "application/octet-stream",
  ".flac": "audio/flac",
  ".gif": "image/gif",
  ".gz": "application/gzip",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/vnd.microsoft.icon",
  ".ics": "text/calendar; charset=utf-8",
  ".jfif": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".m4a": "audio/mp4",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".ogv": "video/ogg",
  ".opus": "audio/ogg",
  ".pdf": "application/pdf",
  ".pjp": "image/jpeg",
  ".pjpeg": "image/jpeg",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ps": "application/postscript",
  ".rdf": "application/rdf+xml",
  ".rtf": "application/rtf",
  ".shtml": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".text": "text/plain; charset=utf-8",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".txt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".webp": "image/webp",
  ".xbl": "text/xml; charset=utf-8",
  ".xbm": "image/x-xbitmap",
  ".xht": "application/xhtml+xml",
  ".xhtml": "application/xhtml+xml",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xml": "text/xml; charset=utf-8",
  ".xsl": "text/xml; charset=utf-8",
  ".zip": "application/zip",
})

/** Go's `filepath.Ext`: the suffix from the last "." in the final path element. */
export function goExt(path: string): string {
  for (let i = path.length - 1; i >= 0 && path[i] !== "/"; i--) {
    if (path[i] === ".") return path.slice(i)
  }
  return ""
}

/** Go's `mime.TypeByExtension` against the built-in table (case-insensitive). */
export function contentTypeFor(path: string): string {
  const ext = goExt(path)
  return Object.hasOwn(GO_BUILTIN_MIME_TYPES, ext)
    ? GO_BUILTIN_MIME_TYPES[ext]
    : (GO_BUILTIN_MIME_TYPES[ext.toLowerCase()] ?? "")
}
