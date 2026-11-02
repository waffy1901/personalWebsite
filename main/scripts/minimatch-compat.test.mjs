import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import match, { Minimatch, minimatch, braceExpand } from 'minimatch';

const require = createRequire(import.meta.url);
const main = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('patched minimatch compatibility', () => {
  it('provides callable CommonJS and ESM APIs backed by the fixed registry package', () => {
    const cjs = require('minimatch');
    const patched = require('minimatch-patched');
    expect(cjs).toBe(patched.minimatch);
    expect(match).toBe(minimatch);
    expect(cjs('renderFooter', 'render*')).toBe(true);
    expect(cjs('footer', 'render*')).toBe(false);
    expect(new cjs.Minimatch('src/**/*.{js,jsx}').match('src/App.jsx')).toBe(true);
    expect(new Minimatch('e2e/**/*.js').match('e2e/a11y.spec.js')).toBe(true);
    expect(braceExpand('*.{js,jsx}')).toEqual(['*.js', '*.jsx']);
    expect(cjs.defaults({ nocase: true })('APP.JSX', '*.jsx')).toBe(true);
    const manifest = require('minimatch-patched/package.json');
    expect(manifest.name).toBe('minimatch');
    expect(manifest.version).toBe('11.0.1');
    for (const consumer of ['eslint', 'eslint-plugin-react', '@eslint/config-array', '@eslint/eslintrc']) {
      const consumerRequire = createRequire(require.resolve(consumer));
      expect(consumerRequire.resolve('minimatch')).toBe(require.resolve('minimatch'));
    }
  });

  it('preserves constructor matching options used by ESLint consumers', () => {
    const matcher = new Minimatch('src/**/*.jsx', { dot: true });
    expect(matcher.match('src/.hidden/App.jsx')).toBe(true);
    expect(matcher.match('src', true)).toBe(true);
    expect(matcher.match('src')).toBe(false);
    expect(new Minimatch('*.jsx', { matchBase: true, dot: true }).match('src/.App.jsx')).toBe(true);
    expect(new Minimatch('!src/**', { flipNegate: true }).match('src/App.jsx')).toBe(true);
    expect(match('a/x/y/b', 'a/**/b', { noglobstar: true })).toBe(false);
    expect(match('a/x/y/b', 'a/**/b')).toBe(true);
  });

  it('retains actual config file selection and ignore behavior', async () => {
    const eslint = new ESLint({ cwd: main });
    for (const file of ['src/App.jsx', 'src/App.test.jsx', 'e2e/a11y.spec.js', 'playwright.production.config.js']) {
      expect(await eslint.isPathIgnored(file), file).toBe(false);
    }
    for (const file of ['dist/app.js', 'coverage/app.js', 'node_modules/tool/index.js', 'playwright-report/app.js']) {
      expect(await eslint.isPathIgnored(file), file).toBe(true);
    }
    const appConfig = await eslint.calculateConfigForFile('src/App.jsx');
    const testConfig = await eslint.calculateConfigForFile('src/App.test.jsx');
    const e2eConfig = await eslint.calculateConfigForFile('e2e/a11y.spec.js');
    expect(appConfig.rules['react/jsx-no-undef'][0]).toBe(2);
    expect(testConfig.languageOptions.globals.expect).toBeDefined();
    expect(e2eConfig.languageOptions.sourceType).toBe('commonjs');
    const [negative] = await eslint.lintText('export default function App() { return <Missing />; }', { filePath: 'src/compat-negative.jsx' });
    expect(negative.messages.map(({ ruleId }) => ruleId)).toContain('react/jsx-no-undef');
  });

  it('keeps the React render-prop rule callable and detects invalid nested props', async () => {
    const eslint = new ESLint({
      cwd: main,
      overrideConfig: { rules: { 'react/no-unstable-nested-components': 'error' } },
    });
    const lint = async (prop) => {
      const [output] = await eslint.lintText(
        `const Panel = () => null; export default function App() { return <Panel ${prop}={() => <div />} />; }`,
        { filePath: 'src/compat-render-prop.jsx' },
      );
      return output.messages.filter(({ ruleId }) => ruleId === 'react/no-unstable-nested-components');
    };
    expect(await lint('renderFooter')).toEqual([]);
    expect(await lint('footer')).toHaveLength(1);
  });
});
