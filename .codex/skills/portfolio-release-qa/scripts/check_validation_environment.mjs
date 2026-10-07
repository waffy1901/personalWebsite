#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkEnvironment(root, nodeVersion = process.versions.node) {
  const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  const pinnedNode = config.match(/^\s*NODE_VERSION\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"\s*$/m)?.[1];
  const mismatches = [];
  if (!pinnedNode) mismatches.push('Netlify Node pin could not be resolved');
  else if (nodeVersion !== pinnedNode) mismatches.push(`Node ${nodeVersion} differs from pin ${pinnedNode}`);
  const packages = [];
  const dependencyFreePackages = [];
  for (const directory of ['main', 'operations']) {
    const packageRoot = path.join(root, directory);
    if (!fs.existsSync(path.join(packageRoot, 'package.json'))) continue;
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
    if (!Object.keys(dependencies).length) {
      dependencyFreePackages.push(directory);
      continue;
    }
    const lock = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package-lock.json'), 'utf8'));
    if (!lock.packages) throw new Error(`${directory}: lockfile packages map is required`);
    for (const name of Object.keys(dependencies).sort()) {
      const expected = lock.packages[`node_modules/${name}`]?.version;
      if (!expected) throw new Error(`${directory}: no locked direct version for ${name}`);
      const installedFile = path.join(packageRoot, 'node_modules', name, 'package.json');
      const actual = fs.existsSync(installedFile) ? JSON.parse(fs.readFileSync(installedFile, 'utf8')).version : null;
      packages.push({ directory, name, expected, actual });
      if (actual !== expected) mismatches.push(`${directory}/${name}: installed ${actual ?? 'missing'}, locked ${expected}`);
    }
  }
  if (!packages.length) throw new Error('No direct package dependencies were checked');
  return { node: nodeVersion, pinned_node: pinnedNode ?? null, coherent_top_level: !mismatches.length,
    authoritative_install: false, packages, dependency_free_packages: dependencyFreePackages, mismatches };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node check_validation_environment.mjs REPOSITORY_ROOT');
    const result = checkEnvironment(path.resolve(process.argv[2]));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.coherent_top_level ? 0 : 1;
  } catch (error) {
    console.error(`Validation environment unavailable: ${error.message}`);
    process.exitCode = 2;
  }
}
