export type LegalPageKey = "terms" | "privacy" | "imprint"

export interface LegalPage {
  key: LegalPageKey
  label: string
  /** In-app route rendering the page, linked when its content is bundled. */
  path: `/${LegalPageKey}`
  /** Whether VITE_<KEY>_URL was a file path. Compared here rather than passing the HTML on, so the
   * minifier folds it to a constant and the content stays in the LegalPage chunk. */
  bundled: boolean
  /** External URL, used when no content is bundled. Empty when unset (link hidden). */
  url: string
}

export const LEGAL_PAGES: LegalPage[] = [
  { key: "terms", label: "Terms", path: "/terms", bundled: __TERMS_HTML__ !== "", url: __TERMS_URL__ },
  { key: "privacy", label: "Privacy", path: "/privacy", bundled: __PRIVACY_HTML__ !== "", url: __PRIVACY_URL__ },
  { key: "imprint", label: "Imprint", path: "/imprint", bundled: __IMPRINT_HTML__ !== "", url: __IMPRINT_URL__ },
]

export function getLegalPage(key: LegalPageKey): LegalPage {
  return LEGAL_PAGES.find(page => page.key === key)!
}
