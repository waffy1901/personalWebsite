import js from '../main/node_modules/@eslint/js/src/index.js';
import globals from '../main/node_modules/globals/index.js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.es2021, ...globals.worker, ...globals.node },
    },
  },
];
