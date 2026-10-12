/** Footer documentation link, and the default for the other docs links. */
export const DOCS_URL = import.meta.env.VITE_DOCS_URL || "https://docs.safefoundation.org/safenet/"

/** Footer FAQ link. */
export const FAQ_URL = import.meta.env.VITE_FAQ_URL || DOCS_URL

/** "Learn more" link in the dashboard rewards tooltip. */
export const REWARDS_DOCS_URL = import.meta.env.VITE_REWARDS_DOCS_URL || DOCS_URL

/** "See here for more details" link in the validator commission tooltip. */
export const COMMISSION_DOCS_URL = import.meta.env.VITE_COMMISSION_DOCS_URL || DOCS_URL
