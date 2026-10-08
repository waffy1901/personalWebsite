import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkEnvironment } from './check_validation_environment.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-install-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'netlify.toml'), '[build.environment]\nNODE_VERSION = "22.22.3"\n');
  for (const [directory, name] of [['main', '@playwright/test'], ['operations', 'eslint']]) {
    const packageRoot = path.join(root, directory);
    fs.mkdirSync(path.join(packageRoot, 'node_modules', name), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ devDependencies: { [name]: '^1.2.3' } }));
    fs.writeFileSync(path.join(packageRoot, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { [`node_modules/${name}`]: { version: '1.2.3' } } }));
    fs.writeFileSync(path.join(packageRoot, 'node_modules', name, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  }
  return root;
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
