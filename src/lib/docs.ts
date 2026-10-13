/** Footer documentation link, and the root the other docs links default to. */
export const DOCS_URL = import.meta.env.VITE_DOCS_URL || "https://docs.safefoundation.org/safenet-aegis/"

// Trailing slash so the default paths below resolve under the docs root
const docsBase = DOCS_URL.endsWith("/") ? DOCS_URL : `${DOCS_URL}/`

/** Footer FAQ link. */
export const FAQ_URL = import.meta.env.VITE_FAQ_URL || `${docsBase}resources/faqs`

/** "Learn more" link in the dashboard rewards tooltip. */
export const REWARDS_DOCS_URL = import.meta.env.VITE_REWARDS_DOCS_URL || `${docsBase}staking/rewards`

/** "See here for more details" link in the validator commission tooltip. */
export const COMMISSION_DOCS_URL = import.meta.env.VITE_COMMISSION_DOCS_URL || `${docsBase}staking/how-to-stake`
