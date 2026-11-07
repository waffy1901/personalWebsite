import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkEnvironment } from './check_validation_environment.mjs';

function fixture(t, pinnedNode = '22.22.3') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-install-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'netlify.toml'), `[build.environment]\nNODE_VERSION = "${pinnedNode}"\n`);
  for (const [directory, name] of [['main', '@playwright/test'], ['operations', 'eslint']]) {
    const packageRoot = path.join(root, directory);
    fs.mkdirSync(path.join(packageRoot, 'node_modules', name), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ devDependencies: { [name]: '^1.2.3' } }));
    fs.writeFileSync(path.join(packageRoot, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { [`node_modules/${name}`]: { version: '1.2.3' } } }));
    fs.writeFileSync(path.join(packageRoot, 'node_modules', name, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  }
  return root;
}

function linkedFixture(t, {
  target = 'tools/minimatch-compat',
  resolved = target,
  lockedVersion = '1.0.0',
  installedVersion = '1.0.0',
} = {}) {
  const root = fixture(t, process.versions.node);
  const main = path.join(root, 'main');
  const manifestFile = path.join(main, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.devDependencies.minimatch = `file:${target || '.'}`;
  if (!target) manifest.version = installedVersion;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));

  const lockFile = path.join(main, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.packages['node_modules/minimatch'] = { link: true, resolved };
  lock.packages[target] = { version: lockedVersion };
  fs.writeFileSync(lockFile, JSON.stringify(lock));

  const targetDir = path.join(main, target);
  if (target) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({ version: installedVersion }));
  }
  const modules = path.join(main, 'node_modules');
  fs.symlinkSync(path.relative(modules, targetDir), path.join(modules, 'minimatch'), 'dir');
  return root;
}

function runChecker(root) {
  const script = fileURLToPath(new URL('./check_validation_environment.mjs', import.meta.url));
  return spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
}

test('matching direct modules still do not prove a clean install', (t) => {
  const result = checkEnvironment(fixture(t), '22.22.3');
  assert.equal(result.coherent_top_level, true);
  assert.equal(result.authoritative_install, false);
  assert.equal(result.packages.length, 2);
});

test('runtime mismatch is detected', (t) => {
  const result = checkEnvironment(fixture(t), '24.0.0');
  assert.equal(result.coherent_top_level, false);
  assert.ok(result.mismatches.some(value => value.startsWith('Node')));
});

test('dependency-free operations does not require a lockfile or modules', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'operations/package.json'), '{"private":true}');
  fs.rmSync(path.join(root, 'operations/package-lock.json'));
  fs.rmSync(path.join(root, 'operations/node_modules'), { recursive: true });
  const result = checkEnvironment(root, '22.22.3');
  assert.equal(result.coherent_top_level, true);
  assert.deepEqual(result.dependency_free_packages, ['operations']);
  assert.equal(result.packages.length, 1);
});

test('stale scoped Playwright modules are detected', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'main/node_modules/@playwright/test/package.json'), '{"version":"1.2.2"}');
  const result = checkEnvironment(root, '22.22.3');
  assert.equal(result.coherent_top_level, false);
  assert.ok(result.mismatches.some(value => value.includes('@playwright/test')));
});

test('missing operations modules are detected without repairing the checkout', (t) => {
  const root = fixture(t);
  fs.rmSync(path.join(root, 'operations/node_modules/eslint'), { recursive: true });
  assert.equal(checkEnvironment(root, '22.22.3').coherent_top_level, false);
  assert.equal(fs.existsSync(path.join(root, 'operations/node_modules/eslint')), false);
});

test('unresolved lock versions cannot produce a successful diagnostic', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'main/package-lock.json'), '{"packages":{}}');
  assert.throws(() => checkEnvironment(root, '22.22.3'), /no locked direct version/);
});

test('links to a local package or the package root use the locked target version', (t) => {
  for (const target of ['tools/minimatch-compat', '']) {
    const result = runChecker(linkedFixture(t, { target }));
    assert.equal(result.status, 0, result.stderr);
    const { packages } = JSON.parse(result.stdout);
    assert.deepEqual(packages.find(({ name }) => name === 'minimatch'), {
      directory: 'main', name: 'minimatch', expected: '1.0.0', actual: '1.0.0',
    });
  }
});

test('missing or malformed locked link targets exit as unavailable', (t) => {
  for (const [options, diagnostic] of [
    [{ resolved: 'tools/missing' }, 'no locked version for minimatch at link target "tools/missing"'],
    [{ resolved: null }, 'invalid locked link target for minimatch'],
    [{ lockedVersion: 1 }, 'no locked version for minimatch at link target "tools/minimatch-compat"'],
  ]) {
    const result = runChecker(linkedFixture(t, options));
    assert.equal(result.status, 2, result.stderr);
    assert.ok(result.stderr.includes(diagnostic), result.stderr);
  }
});

test('a stale installed link version exits as incoherent', (t) => {
  const result = runChecker(linkedFixture(t, { installedVersion: '1.0.1' }));
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).mismatches, ['main/minimatch: installed 1.0.1, locked 1.0.0']);
});

test('a dangling installed link exits as missing', (t) => {
  const root = linkedFixture(t);
  fs.rmSync(path.join(root, 'main/tools/minimatch-compat'), { recursive: true });
  const result = runChecker(root);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).mismatches, ['main/minimatch: installed missing, locked 1.0.0']);
});
