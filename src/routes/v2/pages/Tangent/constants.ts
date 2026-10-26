/** Bundle that backs embedded Tangent sessions started from tangle-ui. */
export const TANGENT_BUNDLE_ID = "tangle";

/**
 * Only used by a dev build or a build served from loopback. A deployed origin
 * that reached for loopback would make Chrome prompt the user for local network
 * access before a request that cannot succeed anyway, so there an unconfigured
 * workspace has no Tangent url at all.
 */
export const DEV_TANGENT_BASE_URL = "http://localhost:5173";
