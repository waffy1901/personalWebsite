import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { checkBundleBudgets, formatReport, gzipOptions } from './check-bundle-budgets.mjs';

const cli = fileURLToPath(new URL('./check-bundle-budgets.mjs', import.meta.url));
const limits = () => ({ js: { raw: 10000, gzip: 10000 }, css: { raw: 10000, gzip: 10000 } });
const basicManifest = () => ({
  'index.html': { file: 'assets/entry-hash.js', isEntry: true, css: ['assets/base.css'], dynamicImports: ['src/route.jsx'] },
  'src/route.jsx': { file: 'assets/route-hash.js', isDynamicEntry: true, imports: ['index.html'] },
});

function fixture(t, manifest = basicManifest()) {
  const dist = mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-test-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  mkdirSync(path.join(dist, '.vite'));
  const configPath = path.join(dist, 'budgets.json');
  const config = { version: 1, startup: limits(), lazy: {} };
  for (const [source, chunk] of Object.entries(manifest)) {
    if (chunk.isDynamicEntry) config.lazy[source] = limits();
    for (const file of [chunk.file, ...(chunk.css ?? [])]) {
      mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
      writeFileSync(path.join(dist, file), `/* ${file} */`);
    }
  }
  const save = () => {
    writeFileSync(path.join(dist, '.vite/manifest.json'), JSON.stringify(manifest));
    writeFileSync(configPath, JSON.stringify(config));
  };
  save();
  return { dist, configPath, config, manifest, save,
    check: () => checkBundleBudgets({ dist, configPath }),
    run: (...args) => spawnSync(process.execPath, [cli, '--dist', dist, '--config', configPath, ...args], { encoding: 'utf8' }),
  };
}

test('exact raw/gzip boundaries pass; raw-only and gzip-only excess fail with paths and deltas', (t) => {
  const f = fixture(t);
  const measured = f.check();
  for (const row of measured.rows) {
    const budget = row.name === 'startup' ? f.config.startup : f.config.lazy[row.name];
    for (const metric of row.metrics) budget[metric.type] = { raw: metric.raw, gzip: metric.gzip };
  }
  f.save();
  assert.equal(f.check().passed, true);
  assert.equal(f.run().status, 0);
  for (const metric of ['raw', 'gzip']) {
    f.config.startup.js[metric] -= 1;
    f.save();
    const run = f.run();
    assert.equal(run.status, 1);
    assert.match(run.stdout, new RegExp(`js ${metric}: actual=\\d+ limit=\\d+ delta=\\+1 OVER LIMIT`));
    assert.match(run.stdout, /assets\/entry-hash.js/);
    assert.match(run.stdout, /Elapsed: [\d.]+ ms/);
    f.config.startup.js[metric] += 1;
  }
});

test('static diamond/cycle, CSS path dedup, startup subtraction and per-route shared lazy accounting', (t) => {
  const manifest = {
    entry: { file: 'assets/entry.js', isEntry: true, imports: ['left', 'right'], dynamicImports: ['routeA', 'routeB'], css: ['assets/common.css'] },
    left: { file: 'assets/left.js', imports: ['shared'], css: ['assets/common.css'] },
    right: { file: 'assets/right.js', imports: ['shared'] },
    shared: { file: 'assets/shared.js', imports: ['entry'], css: ['assets/common.css'] },
    routeA: { file: 'assets/a.js', isDynamicEntry: true, imports: ['shared', 'lazyShared'], css: ['assets/common.css', 'assets/lazy.css'] },
    routeB: { file: 'assets/b.js', isDynamicEntry: true, imports: ['lazyShared'], css: ['assets/lazy.css'] },
    lazyShared: { file: 'assets/lazy.js', css: ['assets/lazy.css'] },
  };
  const f = fixture(t, manifest);
  const rows = f.check().rows;
  assert.deepEqual(rows[0].metrics[0].files, ['assets/entry.js', 'assets/left.js', 'assets/right.js', 'assets/shared.js']);
  assert.deepEqual(rows[0].metrics[1].files, ['assets/common.css']);
  assert.deepEqual(rows[1].metrics[0].files, ['assets/a.js', 'assets/lazy.js']);
  assert.deepEqual(rows[2].metrics[0].files, ['assets/b.js', 'assets/lazy.js']);
  assert.deepEqual(rows[1].metrics[1].files, ['assets/lazy.css']);
  assert.deepEqual(rows[2].metrics[1].files, ['assets/lazy.css']);
  assert.equal(rows[0].metrics[0].raw, rows[0].metrics[0].files.reduce((n, file) => n + Buffer.byteLength(`/* ${file} */`), 0));
  assert.equal(rows[0].metrics[0].gzip, rows[0].metrics[0].files.reduce((n, file) => n + gzipSync(`/* ${file} */`, gzipOptions).length, 0));
});

test('lazy CSS has independent raw and gzip limits; compression has a fixed zero timestamp', (t) => {
  const f = fixture(t);
  f.manifest['src/route.jsx'].css = ['assets/route.css'];
  writeFileSync(path.join(f.dist, 'assets/route.css'), '.route{color:red}');
  f.save();
  const css = f.check().rows[1].metrics[1];
  for (const metric of ['raw', 'gzip']) {
    f.config.lazy['src/route.jsx'].css[metric] = css[metric] - 1;
    f.save();
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stdout, new RegExp(`css ${metric}: actual=\\d+ limit=\\d+ delta=\\+1 OVER LIMIT`));
    f.config.lazy['src/route.jsx'].css[metric] = 10000;
  }
  const first = gzipSync('fixed payload', gzipOptions);
  assert.equal(first.readUInt32LE(4), 0);
  assert.deepEqual(gzipSync('fixed payload', gzipOptions), first);
});

test('all startup entries are unioned by output path; hash churn changes no measurement', (t) => {
  const f = fixture(t, {
    first: { file: 'assets/one-old.js', isEntry: true },
    second: { file: 'assets/two-old.js', isEntry: true, imports: ['first', 'alias'] },
    alias: { file: 'assets/one-old.js' },
  });
  const before = f.check().rows[0].metrics[0];
  assert.equal(before.files.length, 2);
  for (const chunk of Object.values(f.manifest)) {
    const previous = chunk.file;
    chunk.file = chunk.file.replace('-old', '-new');
    if (previous === 'assets/one-old.js' && chunk === f.manifest.alias) continue;
    renameSync(path.join(f.dist, previous), path.join(f.dist, chunk.file));
  }
  f.save();
  const after = f.check().rows[0].metrics[0];
  assert.equal(after.raw, before.raw);
  assert.equal(after.gzip, before.gzip);
});

test('nested dynamic imports require their own stable budget and never join startup', (t) => {
  const f = fixture(t);
  f.manifest['src/route.jsx'].dynamicImports = ['src/nested.jsx'];
  f.manifest['src/nested.jsx'] = { file: 'assets/nested.js', isDynamicEntry: true };
  writeFileSync(path.join(f.dist, 'assets/nested.js'), 'nested');
  f.save();
  assert.throws(f.check, /Unbudgeted dynamic entry: src\/nested.jsx/);
  f.config.lazy['src/nested.jsx'] = limits();
  f.save();
  const rows = f.check().rows;
  assert.deepEqual(rows[0].metrics[0].files, ['assets/entry-hash.js']);
  assert.deepEqual(rows[1].metrics[0].files, ['assets/route-hash.js']);
  assert.deepEqual(rows[2].metrics[0].files, ['assets/nested.js']);
});

const invalidCases = [
  ['config missing startup', (f) => { delete f.config.startup; }, /must have exactly/],
  ['config unsupported version', (f) => { f.config.version = 2; }, /version must be 1/],
  ['config null lazy', (f) => { f.config.lazy = null; }, /lazy must be an object/],
  ['config misspelled metric', (f) => { f.config.startup.js.gizp = 5; }, /must have exactly/],
  ['config negative limit', (f) => { f.config.startup.js.raw = -1; }, /safe integer/],
  ['config fractional limit', (f) => { f.config.startup.css.gzip = 1.2; }, /safe integer/],
  ['config string limit', (f) => { f.config.startup.js.raw = '10'; }, /safe integer/],
  ['config null limits', (f) => { f.config.startup = null; }, /must be an object/],
  ['missing configured lazy', (f) => { f.config.lazy.absent = limits(); }, /Configured lazy source missing/],
  ['missing dynamic flag', (f) => { delete f.manifest['src/route.jsx'].isDynamicEntry; }, /must be marked isDynamicEntry/],
  ['nonboolean flag', (f) => { f.manifest['index.html'].isEntry = 'true'; }, /must be boolean/],
  ['nonboolean dynamic flag', (f) => { f.manifest['src/route.jsx'].isDynamicEntry = 1; }, /must be marked isDynamicEntry|must be boolean/],
  ['no startup entry', (f) => { delete f.manifest['index.html'].isEntry; }, /no isEntry/],
  ['null chunk', (f) => { f.manifest.extra = null; }, /must be an object/],
  ['dangling static edge', (f) => { f.manifest['index.html'].imports = ['missing']; }, /dangling manifest edge/],
  ['dangling dynamic edge', (f) => { f.manifest['index.html'].dynamicImports = ['missing']; }, /dangling manifest edge/],
  ['imports nonarray', (f) => { f.manifest['index.html'].imports = 'bad'; }, /array of nonempty strings/],
  ['dynamicImports nonarray', (f) => { f.manifest['index.html'].dynamicImports = {}; }, /array of nonempty strings/],
  ['empty import', (f) => { f.manifest['index.html'].imports = ['']; }, /array of nonempty strings/],
  ['null CSS', (f) => { f.manifest['index.html'].css = null; }, /array of nonempty strings/],
  ['CSS wrong extension', (f) => { f.manifest['index.html'].css = ['assets/image.png']; }, /must reference CSS/],
  ['entry wrong extension', (f) => { f.manifest['index.html'].file = 'assets/image.png'; }, /entry output must be JavaScript|must reference a JS/],
  ['import wrong extension', (f) => { f.manifest.image = { file: 'assets/image.png' }; f.manifest['index.html'].imports = ['image']; }, /must reference a JS\/CSS chunk/],
];
for (const [name, mutate, expected] of invalidCases) {
  test(name, (t) => {
    const f = fixture(t);
    mutate(f);
    f.save();
    assert.throws(f.check, expected);
    const run = f.run();
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Bundle budgets FAIL:/);
  });
}

for (const file of ['../escape.js', '/absolute.js', 'assets/../escape.js', 'assets\\escape.js', 'https://bad.js', 'assets//bad.js']) {
  test(`unsafe output path ${file}`, (t) => {
    const f = fixture(t);
    f.manifest['index.html'].file = file;
    f.save();
    assert.throws(f.check, /unsafe output path/);
  });
}

for (const type of ['js', 'css']) {
  for (const mode of ['missing', 'directory', 'symlink', 'parent symlink']) {
    test(`${type} output ${mode} fails`, (t) => {
      const f = fixture(t);
      const file = type === 'js' ? 'assets/entry-hash.js' : 'assets/base.css';
      const absolute = path.join(f.dist, file);
      if (mode === 'parent symlink') {
        const outside = mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-outside-'));
        t.after(() => rmSync(outside, { recursive: true, force: true }));
        writeFileSync(path.join(outside, `escaped.${type}`), 'outside');
        symlinkSync(outside, path.join(f.dist, 'linked'));
        if (type === 'js') f.manifest['index.html'].file = 'linked/escaped.js';
        else f.manifest['index.html'].css = ['linked/escaped.css'];
        f.save();
      } else {
        rmSync(absolute);
        if (mode === 'directory') mkdirSync(absolute);
        if (mode === 'symlink') symlinkSync(path.join(f.dist, 'budgets.json'), absolute);
      }
      assert.throws(f.check, /Invalid JS\/CSS asset/);
    });
  }
}

for (const [name, content] of [['empty', '{}'], ['array', '[]'], ['null', 'null'], ['malformed', '{']]) {
  test(`${name} manifest fails via CLI`, (t) => {
    const f = fixture(t);
    writeFileSync(path.join(f.dist, '.vite/manifest.json'), content);
    assert.equal(f.run().status, 1);
  });
}

test('missing manifest/config and malformed config fail clearly', (t) => {
  const f = fixture(t);
  writeFileSync(f.configPath, '{');
  assert.match(f.run().stderr, /Cannot read budget config/);
  rmSync(f.configPath);
  assert.match(f.run().stderr, /Cannot read budget config/);
  f.save();
  rmSync(path.join(f.dist, '.vite/manifest.json'));
  assert.match(f.run().stderr, /Cannot read Vite manifest/);
});

test('unknown, duplicate and incomplete CLI options fail', (t) => {
  const f = fixture(t);
  for (const args of [['--unknown'], ['--dist', f.dist], ['--config'], ['--dist=bad']]) {
    assert.equal(f.run(...args).status, 1);
  }
  const noValue = spawnSync(process.execPath, [cli, '--dist'], { encoding: 'utf8' });
  assert.equal(noValue.status, 1);
  assert.match(noValue.stderr, /Missing value for --dist/);
  assert.match(formatReport(f.check()), /MTIME=0/);
});
