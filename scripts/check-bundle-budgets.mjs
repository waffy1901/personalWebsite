import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, constants } from 'node:zlib';
import { performance } from 'node:perf_hooks';

const root = fileURLToPath(new URL('../', import.meta.url));
export const gzipOptions = Object.freeze({
  level: 9, windowBits: 15, memLevel: 8, strategy: constants.Z_DEFAULT_STRATEGY,
});

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keys(value, expected, label) {
  requireThat(object(value), `${label} must be an object`);
  requireThat(Object.keys(value).length === expected.length
    && expected.every((key) => Object.hasOwn(value, key)),
  `${label} must have exactly: ${expected.join(', ')}`);
}

function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${label} ${file}: ${error.message}`);
  }
}

function validateLimits(limits, label) {
  keys(limits, ['js', 'css'], label);
  for (const type of ['js', 'css']) {
    keys(limits[type], ['raw', 'gzip'], `${label}.${type}`);
    for (const metric of ['raw', 'gzip']) {
      requireThat(Number.isSafeInteger(limits[type][metric]) && limits[type][metric] >= 0,
        `${label}.${type}.${metric} must be a nonnegative safe integer byte limit`);
    }
  }
}

function validateConfig(config) {
  keys(config, ['version', 'startup', 'lazy'], 'Budget config');
  requireThat(config.version === 1, 'Budget config version must be 1');
  validateLimits(config.startup, 'startup');
  requireThat(object(config.lazy), 'Budget config lazy must be an object keyed by manifest source');
  for (const [source, limits] of Object.entries(config.lazy)) {
    requireThat(source.length > 0, 'Lazy source key must not be empty');
    validateLimits(limits, `lazy[${source}]`);
  }
}

function safeAsset(file, label) {
  requireThat(typeof file === 'string' && file.length > 0
    && !/[\\\x00-\x1f:?#]/.test(file)
    && file.split('/').every((segment) => segment && segment !== '.' && segment !== '..'),
  `${label}: unsafe output path ${JSON.stringify(file)}`);
  return file;
}

function validateManifest(manifest, config) {
  requireThat(object(manifest) && Object.keys(manifest).length > 0,
    'Manifest must be a nonempty object');
  const entries = [];
  const dynamic = [];
  for (const [key, chunk] of Object.entries(manifest)) {
    requireThat(object(chunk), `Manifest entry ${key} must be an object`);
    safeAsset(chunk.file, `${key}.file`);
    for (const flag of ['isEntry', 'isDynamicEntry']) {
      requireThat(!Object.hasOwn(chunk, flag) || typeof chunk[flag] === 'boolean',
        `${key}.${flag} must be boolean`);
    }
    for (const field of ['imports', 'dynamicImports', 'css']) {
      if (!Object.hasOwn(chunk, field)) continue;
      requireThat(Array.isArray(chunk[field]) && chunk[field].every((item) => typeof item === 'string' && item.length > 0),
        `${key}.${field} must be an array of nonempty strings`);
      for (const item of chunk[field]) {
        if (field === 'css') {
          safeAsset(item, `${key}.css`);
          requireThat(item.endsWith('.css'), `${key}.css must reference CSS: ${item}`);
        } else {
          requireThat(Object.hasOwn(manifest, item), `${key}.${field}: dangling manifest edge ${item}`);
          requireThat(object(manifest[item]) && /\.(js|css)$/.test(manifest[item].file),
            `${key}.${field}: edge ${item} must reference a JS/CSS chunk`);
          if (field === 'dynamicImports') {
            requireThat(manifest[item].isDynamicEntry === true,
              `${key}.dynamicImports: ${item} must be marked isDynamicEntry`);
          }
        }
      }
    }
    if (chunk.isEntry || chunk.isDynamicEntry) {
      requireThat(chunk.file.endsWith('.js'), `${key}: entry output must be JavaScript`);
    }
    if (chunk.isEntry) entries.push(key);
    if (chunk.isDynamicEntry) dynamic.push(key);
  }
  requireThat(entries.length > 0, 'Manifest has no isEntry startup chunk');
  for (const source of dynamic) {
    requireThat(Object.hasOwn(config.lazy, source), `Unbudgeted dynamic entry: ${source}`);
  }
  for (const source of Object.keys(config.lazy)) {
    requireThat(Object.hasOwn(manifest, source) && manifest[source].isDynamicEntry === true,
      `Configured lazy source missing or not isDynamicEntry: ${source}`);
  }
  return entries;
}

function staticAssets(manifest, sources) {
  const visited = new Set();
  const assets = new Set();
  function visit(source) {
    if (visited.has(source)) return;
    visited.add(source);
    const chunk = manifest[source];
    assets.add(chunk.file);
    for (const css of chunk.css ?? []) assets.add(css);
    for (const imported of chunk.imports ?? []) visit(imported);
  }
  sources.forEach(visit);
  return assets;
}

export function checkBundleBudgets({ dist = path.join(root, 'main/dist'), configPath = path.join(root, 'config/bundle-budgets.json') } = {}) {
  const config = readJson(configPath, 'budget config');
  validateConfig(config);
  const manifest = readJson(path.join(dist, '.vite/manifest.json'), 'Vite manifest');
  const entries = validateManifest(manifest, config);
  const startup = staticAssets(manifest, entries);
  const groups = [{ name: 'startup', assets: startup, limits: config.startup }];
  for (const [source, limits] of Object.entries(config.lazy)) {
    const assets = staticAssets(manifest, [source]);
    for (const file of startup) assets.delete(file);
    groups.push({ name: source, assets, limits });
  }
  const distRoot = realpathSync(dist);
  const sizes = new Map();
  // Validate every manifest JS/CSS output, including orphan chunks, before measurement.
  for (const chunk of Object.values(manifest)) {
    const files = [...(/\.(js|css)$/.test(chunk.file) ? [chunk.file] : []), ...(chunk.css ?? [])];
    for (const file of files) {
      if (sizes.has(file)) continue;
      try {
        const absolute = path.join(distRoot, file);
        requireThat(lstatSync(absolute).isFile(), 'output must be a regular file (no symlinks)');
        const relative = path.relative(distRoot, realpathSync(absolute));
        requireThat(!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'output escapes dist');
        const data = readFileSync(absolute);
        sizes.set(file, { raw: data.length, gzip: gzipSync(data, gzipOptions).length });
      } catch (error) {
        throw new Error(`Invalid JS/CSS asset ${file}: ${error.message}`);
      }
    }
  }
  const rows = groups.map(({ name, assets, limits }) => ({
    name,
    metrics: ['js', 'css'].map((type) => {
      const files = [...assets].filter((file) => file.endsWith(`.${type}`)).sort();
      const raw = files.reduce((sum, file) => sum + sizes.get(file).raw, 0);
      const gzip = files.reduce((sum, file) => sum + sizes.get(file).gzip, 0);
      return { type, files, raw, gzip, limits: limits[type] };
    }),
  }));
  const passed = rows.every(({ metrics }) => metrics.every(({ raw, gzip, limits }) => raw <= limits.raw && gzip <= limits.gzip));
  return { passed, rows };
}

export function formatReport({ passed, rows }) {
  const lines = [`Bundle budgets: Node ${process.version}, zlib ${process.versions.zlib}`,
    'Bytes; gzip per file: level=9 windowBits=15 memLevel=8 strategy=Z_DEFAULT_STRATEGY MTIME=0',
    'Delta = actual - limit; positive values fail.'];
  for (const { name, metrics } of rows) {
    lines.push(`\n${name}`);
    for (const { type, files, raw, gzip, limits } of metrics) {
      for (const [metric, actual] of Object.entries({ raw, gzip })) {
        const delta = actual - limits[metric];
        lines.push(`  ${type} ${metric}: actual=${actual} limit=${limits[metric]} delta=${delta >= 0 ? '+' : ''}${delta} ${delta > 0 ? 'OVER LIMIT' : 'OK'}`);
      }
      lines.push(`  ${type} assets: ${files.length ? files.join(', ') : '(none)'}`);
    }
  }
  lines.push(`\nBundle budgets ${passed ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}

function main() {
  const start = performance.now();
  try {
    const options = {};
    const seen = new Set();
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i += 2) {
      const arg = args[i];
      requireThat(['--dist', '--config'].includes(arg) && !seen.has(arg), `Unknown or duplicate argument: ${arg}`);
      requireThat(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value for ${arg}`);
      seen.add(arg);
      options[arg === '--dist' ? 'dist' : 'configPath'] = path.resolve(args[i + 1]);
    }
    const result = checkBundleBudgets(options);
    console.log(formatReport(result));
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(`Bundle budgets FAIL: ${error.message}`);
    process.exitCode = 1;
  } finally {
    console.log(`Elapsed: ${(performance.now() - start).toFixed(1)} ms`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
