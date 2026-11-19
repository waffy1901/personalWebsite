import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { checkAudits, validateAuditResult } from './check-npm-audit.mjs';

const advisory = {
  name: 'minimatch',
  severity: 'moderate',
  url: 'https://github.com/advisories/GHSA-g3hv-75wg-m249',
};
const finding = (via = [advisory], severity = 'moderate') => ({ severity, via });
const report = (vulnerabilities = {}) => ({ auditReportVersion: 2, vulnerabilities });
const result = (data = report(), status = 0) => ({
  status, signal: null, stdout: JSON.stringify(data), stderr: '',
});
const cyclic = report({
  eslint: finding(['eslint-utils', 'minimatch']),
  'eslint-utils': finding(['eslint']),
  minimatch: finding(),
});

const noExceptions = { exceptions: [], lock: { lockfileVersion: 3, packages: {} }, now: 0 };

describe('strict npm audit gate', () => {
  it('keeps the production and full dependency inclusion policy', () => {
    const audit = vi.fn(() => validateAuditResult(result()));
    const log = vi.fn();
    checkAudits(audit, log, noExceptions);
    expect(audit.mock.calls).toEqual([
      [['--omit=dev', '--include=optional', '--include=peer']],
      [['--include=dev', '--include=optional', '--include=peer']],
    ]);
    expect(log.mock.calls.flat()).toEqual([
      'Production dependency audit passed', 'Full dependency audit passed',
    ]);
  });

  it('reports the reachable advisory through a cycle and still rejects it', () => {
    const audit = vi.fn()
      .mockReturnValueOnce(validateAuditResult(result()))
      .mockReturnValueOnce(validateAuditResult(result(cyclic, 1)));
    expect(() => checkAudits(audit, () => {}, noExceptions)).toThrow(
      `eslint-utils (moderate): ${advisory.url}`,
    );
  });

  it.skipIf(process.platform === 'win32')('exits nonzero and prints the advisory for a cyclic npm report', () => {
    const bin = mkdtempSync(join(tmpdir(), 'audit-cli-fixture-'));
    try {
      writeFileSync(join(bin, 'npm'), `#!/usr/bin/env node
const production = process.argv.includes('--omit=dev');
console.log(JSON.stringify(production ? ${JSON.stringify(report())} : ${JSON.stringify(cyclic)}));
process.exitCode = production ? 0 : 1;
`, { mode: 0o700 });
      mkdirSync(join(bin, 'scripts'));
      cpSync(join(import.meta.dirname, 'check-npm-audit.mjs'), join(bin, 'scripts/check-npm-audit.mjs'));
      writeFileSync(join(bin, 'scripts/npm-audit-exceptions.json'), '[]');
      writeFileSync(join(bin, 'package-lock.json'), JSON.stringify(noExceptions.lock));
      const execution = spawnSync(process.execPath, ['scripts/check-npm-audit.mjs'], {
        cwd: bin,
        env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
        encoding: 'utf8',
      });
      expect(execution.status).toBe(1);
      expect(execution.stdout).toContain('Production dependency audit passed');
      expect(execution.stderr).toContain('Full dependency tree contains moderate-or-higher');
      expect(execution.stderr).toContain(advisory.url);
    } finally {
      rmSync(bin, { recursive: true, force: true });
    }
  });

  it('rejects a production finding before attempting the full audit', () => {
    const audit = vi.fn(() => validateAuditResult(result(report({ minimatch: finding() }), 1)));
    expect(() => checkAudits(audit, () => {}, noExceptions)).toThrow('Production dependencies contain');
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it.each(['moderate', 'high', 'critical'])('never accepts %s findings', (severity) => {
    const data = report({ vulnerable: finding([{ ...advisory, severity }], severity) });
    expect(() => checkAudits(() => validateAuditResult(result(data, 1)), () => {}, noExceptions))
      .toThrow(`${severity}): ${advisory.url}`);
  });

  it.each(['info', 'low'])('accepts %s findings at the existing threshold', (severity) => {
    const data = report({ vulnerable: finding([{ ...advisory, severity }], severity) });
    expect(validateAuditResult(result(data))).toEqual(data);
  });

  it.each([
    ['embedded npm error', { ...report(), error: { summary: 'unavailable' } }, 'version 2'],
    ['inconsistent metadata', { ...report(), metadata: { vulnerabilities: { total: 1 } } }, 'counts disagree'],
    ['understated severity', report({ a: finding([advisory], 'low') }), 'understates'],
    ['empty cycle', report({ a: finding(['b']), b: finding(['a']) }), 'unresolved'],
    ['empty via', report({ a: finding([]) }), 'unresolved'],
    ['unknown edge', report({ a: finding(['missing']) }), 'unknown vulnerability'],
    ['malformed via', report({ a: finding(null) }), 'unresolved'],
    ['malformed advisory', report({ a: finding([null]) }), 'malformed advisory'],
    ['missing advisory URL', report({ a: finding([{ name: 'a', severity: 'moderate' }]) }), 'malformed advisory'],
    ['unknown advisory severity', report({ a: finding([{ ...advisory, severity: 'future' }]) }), 'malformed advisory'],
    ['unknown severity', report({ a: finding([advisory], 'future') }), 'unknown vulnerability severity'],
    ['null vulnerability', report({ a: null }), 'unknown vulnerability severity'],
    ['array vulnerabilities', report([]), 'version 2'],
    ['wrong version', { ...report(), auditReportVersion: 1 }, 'version 2'],
    ['no report', {}, 'version 2'],
    ['null report', null, 'version 2'],
  ])('fails closed for %s', (_name, data, message) => {
    expect(() => validateAuditResult(result(data, 1))).toThrow(message);
  });

  it.each([
    [report(), 1],
    [report({ a: finding() }), 0],
    [report({ a: finding([{ ...advisory, severity: 'low' }], 'low') }), 1],
  ])('rejects a mismatched npm exit status', (data, status) => {
    expect(() => validateAuditResult(result(data, status))).toThrow('does not match');
  });

  it.each([
    [{ ...result(), stdout: '{' }, 'malformed JSON'],
    [{ ...result(), error: new Error('spawn failed') }, 'could not start'],
    [{ ...result(), status: 2 }, 'failed unexpectedly'],
    [{ ...result(), status: null, signal: 'SIGTERM' }, 'failed unexpectedly'],
  ])('rejects audit execution failures', (execution, message) => {
    expect(() => validateAuditResult(execution)).toThrow(message);
  });
});

const picomatch = {
  name: 'picomatch', dependency: 'picomatch', severity: 'high',
  url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf', range: '<=4.0.7',
};
const majorDowngrade = (name, version) => ({ name, version, isSemVerMajor: true });
const viteDowngrade = majorDowngrade('vite', '6.2.7');
const vitestDowngrade = majorDowngrade('vitest', '3.1.4');
const knownDevChain = [
  ['@vitejs/plugin-react', '6.3.0', ['vite'], majorDowngrade('@vitejs/plugin-react', '5.2.0')],
  ['fdir', '6.5.0', ['picomatch'], true],
  ['picomatch', '4.0.7', [picomatch], vitestDowngrade],
  ['tinyglobby', '0.2.17', ['fdir', 'picomatch'], vitestDowngrade],
  ['vite', '8.3.8', ['picomatch', 'tinyglobby'], viteDowngrade],
  ['vitest', '5.1.0', ['picomatch', 'tinyglobby', 'vite'], vitestDowngrade],
];

function exceptionFixture() {
  // Exercise the historical waiver as synthetic test data, not a live CI exception.
  const exceptions = [{
    package: 'picomatch',
    advisory: picomatch.url,
    affectedRange: picomatch.range,
    severity: 'high',
    owner: '@waffy1901',
    tracker: 'https://github.com/waffy1901/personalWebsite/issues/352',
    reason: 'Synthetic fixture for testing bounded exception enforcement.',
    createdAt: '2026-11-18T00:31:39Z',
    reviewedAt: '2026-11-18T00:31:39Z',
    expiresAt: '2026-11-25T00:00:00Z',
    nodes: Object.fromEntries(knownDevChain.map(([name, version, , fixAvailable]) => {
      const path = name === 'fdir' ? 'node_modules/tinyglobby/node_modules/fdir' : 'node_modules/' + name;
      const suggestions = ['picomatch', 'tinyglobby'].includes(name)
        ? [viteDowngrade, vitestDowngrade]
        : [fixAvailable];
      return [path, { version, npmFixSuggestions: suggestions }];
    })),
  }];
  const lock = { lockfileVersion: 3, packages: {} };
  const full = report();
  for (const [name, version, via, fixAvailable] of knownDevChain) {
    const path = name === 'fdir' ? 'node_modules/tinyglobby/node_modules/fdir' : 'node_modules/' + name;
    lock.packages[path] = { version, dev: true };
    full.vulnerabilities[name] = structuredClone({ name, severity: 'high', nodes: [path], via, fixAvailable });
  }
  const policy = { exceptions, lock, now: Date.parse('2026-11-18T01:00:00Z') };
  const log = vi.fn();
  const run = (production = report()) => {
    const audit = vi.fn()
      .mockImplementationOnce(() => validateAuditResult(result(production, Object.keys(production.vulnerabilities).length ? 1 : 0)))
      .mockImplementationOnce(() => validateAuditResult(result(full, 1)));
    checkAudits(audit, log, policy);
  };
  return { full, findings: full.vulnerabilities, log, policy, entry: exceptions[0], run };
}

describe('tracked development audit exception', () => {
  it('ships an empty active registry and blocks the formerly waived development findings', () => {
    const active = JSON.parse(readFileSync(join(import.meta.dirname, 'npm-audit-exceptions.json'), 'utf8'));
    expect(active).toEqual([]);
    const { full, policy } = exceptionFixture();
    policy.exceptions = active;
    const audit = vi.fn()
      .mockReturnValueOnce(validateAuditResult(result()))
      .mockReturnValueOnce(validateAuditResult(result(full, 1)));
    expect(() => checkAudits(audit, () => {}, policy)).toThrow(
      `picomatch (high): ${picomatch.url}`,
    );
  });

  it('prints each exact waived package with the advisory, issue and expiry', () => {
    const { log, run } = exceptionFixture();
    run();
    for (const [name] of knownDevChain) {
      expect(log).toHaveBeenCalledWith(`Waived dev audit finding: ${name} - ${picomatch.url} (tracker https://github.com/waffy1901/personalWebsite/issues/352, expires 2026-11-25T00:00:00Z)`);
    }
    expect(log).toHaveBeenLastCalledWith('Full dependency audit passed with 6 waived development package findings');
  });

  it('accepts a reachable cycle, the alternate reviewed ancestor suggestion and no-fix signals', () => {
    const { findings, run } = exceptionFixture();
    findings.vite.via.push('vitest');
    findings.picomatch.fixAvailable = viteDowngrade;
    findings.tinyglobby.fixAvailable = viteDowngrade;
    findings.vitest.fixAvailable = false;
    run();
  });

  it('blocks the same advisory in production', () => {
    const { full, run } = exceptionFixture();
    expect(() => run(full)).toThrow('Production dependencies contain');
  });

  it.each([
    ['another advisory', ({ findings }) => { findings.picomatch.via.push(advisory); }],
    ['another affected range', ({ findings }) => { findings.picomatch.via[0].range = '<=4.0.8'; }],
    ['another advisory source', ({ findings }) => { findings.fdir.via.push(picomatch); }],
    ['a mismatched advisory dependency', ({ findings }) => { findings.picomatch.via[0].dependency = 'something-else'; }],
    ['critical advisory', ({ findings }) => { findings.picomatch.via[0].severity = 'critical'; }],
    ['critical metavulnerability', ({ findings }) => { findings.vite.severity = 'critical'; }],
    ['missing chain', ({ findings }) => { delete findings.fdir; }],
    ['additional installed path', ({ findings }) => { findings.picomatch.nodes.push('node_modules/other/node_modules/picomatch'); }],
    ['additional package in the chain', ({ findings }) => {
      findings.other = { ...findings.vite, name: 'other' };
      findings.vitest.via.push('other');
    }],
    ['mismatched package name', ({ findings }) => { findings.vite.name = 'vitest'; }],
    ['mismatched path name', ({ findings }) => { findings.vite.nodes = findings.vitest.nodes; }],
    ['empty node list', ({ findings }) => { findings.vite.nodes = []; }],
    ['missing fix status', ({ findings }) => { delete findings.vite.fixAvailable; }],
    ['fix is now available', ({ findings }) => { findings.picomatch.fixAvailable = true; }],
    ['new patch', ({ findings }) => { findings.picomatch.fixAvailable = majorDowngrade('picomatch', '4.0.8'); }],
    ['compatible upgrade', ({ findings }) => { findings.vite.fixAvailable.isSemVerMajor = false; }],
    ['different major repair', ({ findings }) => { findings.vite.fixAvailable = majorDowngrade('vite', '7.0.1'); }],
    ['wrong major repair target', ({ findings }) => { findings.vite.fixAvailable = vitestDowngrade; }],
    ['malformed repair', ({ findings }) => { findings.vite.fixAvailable.extra = true; }],
    ['absent lock node', ({ policy }) => { delete policy.lock.packages['node_modules/picomatch']; }],
    ['changed version', ({ policy }) => { policy.lock.packages['node_modules/vite'].version = '8.3.9'; }],
    ['changed dev status', ({ policy }) => { delete policy.lock.packages['node_modules/picomatch'].dev; }],
    ['optional production path', ({ policy }) => { policy.lock.packages['node_modules/picomatch'].devOptional = true; }],
    ['linked package', ({ policy }) => { policy.lock.packages['node_modules/picomatch'].link = true; }],
    ['malformed lock', ({ policy }) => { policy.lock.packages = []; }],
    ['malformed registry', ({ policy }) => { policy.exceptions = {}; }],
    ['duplicate advisory', ({ policy, entry }) => { policy.exceptions.push(entry); }],
    ['missing owner', ({ entry }) => { delete entry.owner; }],
    ['missing reason', ({ entry }) => { entry.reason = ' '; }],
    ['foreign tracker', ({ entry }) => { entry.tracker = 'https://example.org/352'; }],
    ['wildcard version', ({ entry }) => { entry.nodes['node_modules/vite'].version = '*'; }],
    ['invalid repair policy', ({ entry }) => { entry.nodes['node_modules/picomatch'].npmFixSuggestions = [{}]; }],
    ['expired at the cutoff', ({ policy, entry }) => { policy.now = Date.parse(entry.expiresAt); }],
    ['future review', ({ entry }) => { entry.reviewedAt = '2026-11-19T00:00:00Z'; }],
    ['impossible date', ({ entry }) => { entry.expiresAt = '2026-11-31T00:00:00Z'; }],
    ['overlong review window', ({ entry }) => { entry.expiresAt = '2026-12-25T00:00:00Z'; }],
  ])('blocks %s', (_name, change) => {
    const fixture = exceptionFixture();
    change(fixture);
    expect(() => fixture.run()).toThrow();
  });
});
