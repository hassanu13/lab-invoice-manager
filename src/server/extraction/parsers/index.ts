/**
 * Parser registry bootstrap.
 *
 * Importing this module side-effect-registers all available parsers. Callers
 * should `import './parsers'` once at the top of any entry point that uses
 * extraction (currently src/server/extraction/extract.ts).
 *
 * Add new lab parsers by:
 *   1. Creating ./<labKey>.ts that calls registerParser(...)
 *   2. Importing it from this file.
 */

// Parsers will be added here as they're ported from extract_invoice.py.
// Each parser file calls `registerParser(...)` at module top level.

// Reserved imports — uncomment as parsers land:
// import './3dental';
// import './dent8-innovate';
// import './hall';
// import './carl-kearney';
// import './aesthetic-world';
// import './digital-prosthetics';
// import './s4s';
// import './standard';

export {};
