import { readFile } from 'node:fs/promises';

export const CORE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseCoreVersion(version) {
  if (typeof version !== 'string' || !CORE_VERSION_PATTERN.test(version)) {
    throw new Error(`Release version must be a core MAJOR.MINOR.PATCH value: ${version}`);
  }

  return version.split('.').map(Number);
}

export function toReleaseTag(version) {
  parseCoreVersion(version);
  return `v${version}`;
}

export function compareCoreVersions(left, right) {
  const leftParts = parseCoreVersion(left);
  const rightParts = parseCoreVersion(right);

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1;
    }
  }

  return 0;
}

export function assertVersionSources(packageJson, packageLock) {
  const packageVersion = packageJson?.version;
  const lockVersion = packageLock?.version;
  const rootPackageVersion = packageLock?.packages?.['']?.version;

  parseCoreVersion(packageVersion);
  parseCoreVersion(lockVersion);
  parseCoreVersion(rootPackageVersion);

  if (packageVersion !== lockVersion || packageVersion !== rootPackageVersion) {
    throw new Error(
      `main/package.json (${packageVersion}) and main/package-lock.json (${lockVersion}, ${rootPackageVersion}) must agree.`,
    );
  }

  return packageVersion;
}

export function classifyReleaseCollision({ tag, targetCommit, tagTarget, release }) {
  if (!tagTarget && !release) return 'publish';
  if (!release) return 'tag-only';
  if (release.draft) return 'draft';
  if (!tagTarget) return 'release-without-tag';
  if (tagTarget !== targetCommit) return 'different-target';
  return release.tag_name === tag ? 'idempotent' : 'duplicate-release';
}

export async function readAuthoritativeVersion({
  packagePath = new URL('../package.json', import.meta.url),
  lockPath = new URL('../package-lock.json', import.meta.url),
} = {}) {
  const [packageJson, packageLock] = await Promise.all([
    readFile(packagePath, 'utf8').then(JSON.parse),
    readFile(lockPath, 'utf8').then(JSON.parse),
  ]);

  return assertVersionSources(packageJson, packageLock);
}

async function main() {
  const requestedVersion = process.argv[2];
  parseCoreVersion(requestedVersion);
  const authoritativeVersion = await readAuthoritativeVersion();

  if (requestedVersion !== authoritativeVersion) {
    throw new Error(`Requested ${requestedVersion} does not match main/package.json ${authoritativeVersion}.`);
  }

  process.stdout.write(`${toReleaseTag(requestedVersion)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
