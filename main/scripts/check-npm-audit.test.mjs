import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('strict npm audit gate', () => {
  it('keeps the production and full dependency inclusion policy', () => {
    const audit = vi.fn(() => validateAuditResult(result()));
    const log = vi.fn();
    checkAudits(audit, log);
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
    expect(() => checkAudits(audit, () => {})).toThrow(
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
      const execution = spawnSync(process.execPath, ['scripts/check-npm-audit.mjs'], {
        cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
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
    expect(() => checkAudits(audit, () => {})).toThrow('Production dependencies contain');
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it.each(['moderate', 'high', 'critical'])('never accepts %s findings', (severity) => {
    const data = report({ vulnerable: finding([{ ...advisory, severity }], severity) });
    expect(() => checkAudits(() => validateAuditResult(result(data, 1)), () => {}))
      .toThrow(`${severity}): ${advisory.url}`);
  });

  it.each(['info', 'low'])('accepts %s findings at the existing threshold', (severity) => {
    const data = report({ vulnerable: finding([{ ...advisory, severity }], severity) });
    expect(validateAuditResult(result(data))).toEqual(data);
  });

  it.each([
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
