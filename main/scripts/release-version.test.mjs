import { describe, expect, it } from 'vitest';
import {
  assertVersionSources,
  classifyReleaseCollision,
  compareCoreVersions,
  parseCoreVersion,
  toReleaseTag,
} from './release-version.mjs';

const matchingSources = {
  packageJson: { version: '0.1.0' },
  packageLock: { version: '0.1.0', packages: { '': { version: '0.1.0' } } },
};

describe('release version validation', () => {
  it('accepts core versions and prefixes tags with v', () => {
    expect(parseCoreVersion('12.34.56')).toEqual([12, 34, 56]);
    expect(toReleaseTag('0.1.0')).toBe('v0.1.0');
    expect(assertVersionSources(matchingSources.packageJson, matchingSources.packageLock)).toBe('0.1.0');
  });

  it.each(['v0.1.0', '01.2.3', '1.02.3', '1.2.03', '1.2', '1.2.3-rc.1', '1.2.3+build', '', '1.2.3.4'])(
    'rejects non-core version %s',
    (version) => expect(() => parseCoreVersion(version)).toThrow('core MAJOR.MINOR.PATCH'),
  );

  it('rejects package and lockfile disagreements', () => {
    expect(() => assertVersionSources({ version: '0.1.0' }, {
      version: '0.1.1', packages: { '': { version: '0.1.0' } },
    })).toThrow('must agree');
    expect(() => assertVersionSources({ version: '0.1.0' }, {
      version: '0.1.0', packages: { '': { version: '0.1.1' } },
    })).toThrow('must agree');
  });

  it('compares version precedence numerically', () => {
    expect(compareCoreVersions('0.1.0', '0.1.1')).toBe(-1);
    expect(compareCoreVersions('0.10.0', '0.2.99')).toBe(1);
    expect(compareCoreVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('distinguishes a safe idempotent replay from collisions', () => {
    const release = { tag_name: 'v0.1.0', draft: false };
    expect(classifyReleaseCollision({ tag: 'v0.1.0', targetCommit: 'a'.repeat(40), tagTarget: 'a'.repeat(40), release })).toBe('idempotent');
    expect(classifyReleaseCollision({ tag: 'v0.1.0', targetCommit: 'a'.repeat(40), tagTarget: 'b'.repeat(40), release })).toBe('different-target');
    expect(classifyReleaseCollision({ tag: 'v0.1.0', targetCommit: 'a'.repeat(40), tagTarget: 'a'.repeat(40), release: { ...release, draft: true } })).toBe('draft');
    expect(classifyReleaseCollision({ tag: 'v0.1.0', targetCommit: 'a'.repeat(40), tagTarget: 'a'.repeat(40), release: null })).toBe('tag-only');
    expect(classifyReleaseCollision({ tag: 'v0.1.0', targetCommit: 'a'.repeat(40), tagTarget: 'a'.repeat(40), release: { tag_name: 'v0.1.1', draft: false } })).toBe('duplicate-release');
  });
});
