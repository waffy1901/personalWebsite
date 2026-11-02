import * as fs from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { globFiles as esmGlobFiles } from '@sentry/bundler-plugins/core';

const require = createRequire(import.meta.url);
const { globFiles: cjsGlobFiles } = require('@sentry/bundler-plugins/core');
const sentryRequire = createRequire(require.resolve('@sentry/bundler-plugins/package.json'));
const { glob, globStream } = sentryRequire('glob');
const fixtures = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lighthouse-glob-'));
  fixtures.push(root);
  const files = [
    'app.js', 'app.js.map', 'nested/chunk.mjs', 'nested/chunk.mjs.map',
    'nested/chunk.cjs', 'nested/chunk.cjs.map', 'nested/query.js?cache#hash',
    'ignored/skip.js', 'styles.css',
  ];
  for (const file of files) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), 'fixture');
  }
  await mkdir(join(root, 'directory.js'), { recursive: true });
  return { root, files };
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Lighthouse transitive glob compatibility', () => {
  it.each([['ESM', esmGlobFiles], ['CommonJS', cjsGlobFiles]])(
    'preserves Sentry %s artifact discovery and ignore semantics',
    async (_, globFiles) => {
      const { root, files } = await fixture();
      const patterns = ['/**/*.js', '/**/*.mjs', '/**/*.cjs', '/**/*.js.map', '/**/*.mjs.map', '/**/*.cjs.map']
        .map((pattern) => `${pattern}?(\\?*)?(#*)`);
      const expected = files.filter((file) => !file.startsWith('ignored/') && file !== 'styles.css')
        .map((file) => resolve(root, file)).sort();
      expect((await globFiles(patterns, { root, ignore: ['**/ignored/**'] })).sort()).toEqual(expected);
      expect((await globFiles(join(root, '**/*.js'), { ignore: ['**/ignored/**'] })).sort())
        .toEqual([resolve(root, 'app.js')]);
    },
  );

  const walks = [
    ['glob()', (pattern, options) => glob(pattern, options)],
    ['globStream()', async (pattern, options) => {
      const matches = [];
      for await (const match of globStream(pattern, options)) matches.push(match);
      return matches;
    }],
  ];

  it.each(walks)('rejects an already canceled %s without reading directories', async (_, walk) => {
    const { root } = await fixture();
    const controller = new AbortController();
    const reason = new Error('canceled before traversal');
    controller.abort(reason);
    let reads = 0;
    await expect(walk('**/*', {
      cwd: root,
      signal: controller.signal,
      fs: { ...fs, readdir: (...args) => { reads += 1; fs.readdir(...args); } },
    })).rejects.toBe(reason);
    expect(reads).toBe(0);
  });

  it.each(walks)('stops %s directory reads after cancellation', async (_, walk) => {
    const { root } = await fixture();
    // Multiple levels distinguish stopped traversal from rejection alone.
    for (let branch = 0; branch < 3; branch += 1) {
      await mkdir(join(root, `tree-${branch}`, 'child', 'leaf'), { recursive: true });
    }
    const controller = new AbortController();
    const reason = new Error('canceled during traversal');
    let reads = 0;
    let pending = 0;
    let idle;
    const drained = new Promise((done) => { idle = done; });
    const trackedFs = {
      ...fs,
      readdir(path, options, callback) {
        reads += 1;
        pending += 1;
        const firstRead = reads === 1;
        fs.readdir(path, options, (...args) => {
          setImmediate(() => {
            if (firstRead) controller.abort(reason);
            try {
              callback(...args);
            } finally {
              pending -= 1;
              if (pending === 0) idle();
            }
          });
        });
      },
    };
    await expect(walk('**/*', { cwd: root, fs: trackedFs, signal: controller.signal }))
      .rejects.toBe(reason);
    const readsAtRejection = reads;
    await drained;
    expect(readsAtRejection).toBeGreaterThan(0);
    expect(reads).toBe(readsAtRejection);
  });
});
