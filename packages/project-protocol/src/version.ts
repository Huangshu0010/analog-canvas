/**
 * The rolling compatibility window is deliberately explicit. Advancing the
 * current schema replaces this adapter instead of extending a migration chain.
 */
export const PREVIOUS_PROJECT_SCHEMA_VERSION = 22;
/** Temporary online-convergence input. Removed after Gallery storage reaches 23. */
export const GALLERY_MIGRATION_SCHEMA_VERSION = 21;
