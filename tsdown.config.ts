/**
 * Two faces, one package:
 *
 * - `lib/index.js` — the host half, ESM for Node, with its own dependencies
 *   left external so the profile's install resolves them.
 * - `lib/client.js` — the browser half, a CommonJS closure factory handed to
 *   `window.__ModuleLoader__.load({ id, factory })`. Every bare specifier stays
 *   external: the shell's module table supplies React, Cordis, and the shared
 *   client libraries, which is also why none of them are runtime dependencies.
 */
import { defineConfig } from 'tsdown'

const PACKAGE_NAME = '@majinggui/dsh-plugin-skill-manager'

export default defineConfig([
  {
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    external: [/^node:/, 'schemastery', 'yaml', /^@deepseek-ai\//],
  },
  {
    entry: ['src/client/index.ts'],
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    // A dynamic browser bundle keeps every bare specifier for the module table.
    external: [/^[^.\/]/],
    outputOptions: { entryFileNames: 'client.js' },
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`
      + '\nvar module = { exports: {} }; var exports = module.exports;'
      + "\nObject.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });",
    footer: 'return module.exports;\n} });',
  },
])
