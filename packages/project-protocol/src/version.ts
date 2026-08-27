/**
 * The rolling compatibility window is deliberately explicit. Advancing the
 * current schema replaces the adapter instead of extending a migration chain.
 * ADR 0047: schema 26 accepts schema 25; schema 24 has left the window.
 */
export const PREVIOUS_PROJECT_SCHEMA_VERSION = 25;
