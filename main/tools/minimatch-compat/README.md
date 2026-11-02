# minimatch compatibility adapter

ESLint 9 and eslint-plugin-react use the legacy minimatch module APIs. All
minimatch releases before 11.0.1 are affected by GHSA-g3hv-75wg-m249, while
11.0.1 exports a CommonJS object and named ESM exports.

This private development-tool adapter forwards matching to the exact official
`minimatch@11.0.1` package, installed under the `minimatch-patched` npm alias.
It exposes the legacy callable CommonJS export with the current named properties,
and an ESM default export alongside the current named exports. It contains no
matcher implementation and has no install scripts.

The root development dependency and `$minimatch` override make npm resolve all
consumers to this local package. The registry alias remains visible to npm audit
under its real package identity. Keep the alias pinned and the lockfile current;
remove this adapter when the lint dependencies support the patched module API.
This covers the callable and `Minimatch` APIs used by this installed lint
toolchain. It does not restore APIs removed upstream, such as `makeRe`, or
promise compatibility for arbitrary future minimatch consumers.

`scripts/minimatch-compat.test.mjs` exercises both module systems, actual ESLint
file selection, and positive/negative React rule controls in the normal test lane.
