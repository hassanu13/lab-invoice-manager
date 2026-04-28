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

// IMPORTANT: order doesn't matter — parsers are looked up by key, not order.
// Listed alphabetically by file name for maintainability.
import './3dental';
import './aesthetic-world';
import './carl-kearney';
import './dent8-innovate';
import './digital-prosthetics';
import './hall';
import './s4s';
import './standard';

export {};
