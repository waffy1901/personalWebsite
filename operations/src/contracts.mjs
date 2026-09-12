/**
 * The public operations API deliberately has a tiny request surface.  Targets
 * are resolved server-side; callers can never supply a URL to probe or fetch.
 */
export const SERVICE_ID = 'portfolio';
export const SERVICE_TARGET = 'https://waffy.dev/';
export const PUBLIC_WINDOWS = Object.freeze({
  '24h': 24 * 60 * 60 * 1_000,
  '7d': 7 * 24 * 60 * 60 * 1_000,
  '30d': 30 * 24 * 60 * 60 * 1_000,
});
export const PUBLIC_STATUS_STATES = Object.freeze(['operational', 'degraded', 'down', 'unknown']);
export const PUBLIC_STATUS_REASONS = Object.freeze([
  'fresh_success', 'slow_response', 'first_failure', 'consecutive_failures',
  'recovery_awaiting_confirmation', 'stale', 'collector_error', 'no_observations',
  'monitoring_disabled', 'no_monitoring_data',
]);
export const PUBLIC_ERROR_CODES = Object.freeze(['invalid_request', 'not_found', 'service_unavailable', 'internal_error']);
const MAX_DATE_MS = 8_640_000_000_000_000;

export class ContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ContractError';
    this.code = code;
  }
}

function requireSingle(searchParams, name, { required = false } = {}) {
  const values = searchParams.getAll(name);
  if (values.length > 1) throw new ContractError(`duplicate_${name}`);
  if (required && values.length === 0) throw new ContractError(`missing_${name}`);
  return values[0] ?? null;
}

/** Resolve the only Phase 1 service identifier to its exact HTTPS target. */
export function resolveServiceTarget(serviceId) {
  if (serviceId !== SERVICE_ID) throw new ContractError('invalid_service');
  return SERVICE_TARGET;
}

export function parsePublicWindow(value) {
  if (typeof value !== 'string' || !Object.hasOwn(PUBLIC_WINDOWS, value)) {
    throw new ContractError('invalid_window');
  }
  return value;
}

/**
 * Parse a public query without accepting unknown or repeated parameters.
 * `window` defaults to 24h, while the service is always explicit.
 */
export function parsePublicRequest(searchParams) {
  if (!(searchParams instanceof URLSearchParams)) {
    throw new ContractError('invalid_query');
  }

  for (const key of searchParams.keys()) {
    if (key !== 'service' && key !== 'window') throw new ContractError('unknown_query_parameter');
  }

  const serviceId = requireSingle(searchParams, 'service', { required: true });
  resolveServiceTarget(serviceId);
  const window = parsePublicWindow(requireSingle(searchParams, 'window') ?? '24h');
  return Object.freeze({ serviceId, window });
}

export function publicWindowRange(window, nowMs) {
  const selectedWindow = parsePublicWindow(window);
  if (!isDateEpoch(nowMs) || nowMs < PUBLIC_WINDOWS[selectedWindow]) throw new ContractError('invalid_now');
  return Object.freeze({
    key: selectedWindow,
    startMs: nowMs - PUBLIC_WINDOWS[selectedWindow],
    endMs: nowMs,
  });
}

function isoUtc(value) {
  return isDateEpoch(value) ? new Date(value).toISOString() : null;
}

function isDateEpoch(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_DATE_MS;
}

function nonNegativeIntegerOrNull(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function finiteNonNegativeOrNull(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function requirePublicValue(value, allowed, name) {
  if (!allowed.includes(value)) throw new ContractError(`invalid_${name}`);
  return value;
}

/**
 * Whitelist a metric result for the public API.  This intentionally does not
 * spread inputs: storage IDs, configuration, error text, response bodies, and
 * owner fields cannot cross this boundary by accident.
 */
export function buildPublicStatusEnvelope({ serviceId, nowMs, status, availability }) {
  resolveServiceTarget(serviceId);
  if (!isDateEpoch(nowMs)) throw new ContractError('invalid_now');
  if (!status || !availability) throw new ContractError('missing_summary');
  const state = requirePublicValue(status.state, PUBLIC_STATUS_STATES, 'state');
  const reason = requirePublicValue(status.reason, PUBLIC_STATUS_REASONS, 'reason');
  const historyWindow = parsePublicWindow(availability.window?.key);

  const history = {
    window: historyWindow,
    startAt: isoUtc(availability.window?.startMs),
    endAt: isoUtc(availability.window?.endMs),
    availability: finiteNonNegativeOrNull(availability.availabilityPercent),
    availabilityNumerator: nonNegativeIntegerOrNull(availability.successfulPrimary),
    availabilityDenominator: nonNegativeIntegerOrNull(availability.completedPrimary),
    coverage: finiteNonNegativeOrNull(availability.coveragePercent),
    coverageNumerator: nonNegativeIntegerOrNull(availability.completedPrimary),
    coverageDenominator: nonNegativeIntegerOrNull(availability.expectedPrimary),
    missingPrimary: nonNegativeIntegerOrNull(availability.missingPrimary),
    hasGaps: Boolean(availability.gaps?.hasGaps),
    lastMissingSlotAt: isoUtc(availability.gaps?.lastMissingSlotAtMs),
  };

  return {
    service: { id: SERVICE_ID },
    generatedAt: new Date(nowMs).toISOString(),
    status: {
      state,
      reason,
      lastObservationAt: isoUtc(status.lastObservationAtMs),
      observationAgeMs: nonNegativeIntegerOrNull(status.observationAgeMs),
      latencyMs: finiteNonNegativeOrNull(status.lastLatencyMs),
      slowThresholdMs: nonNegativeIntegerOrNull(status.slowMs),
      hasGapWarning: Boolean(status.hasGapWarning),
      lastCollectorErrorAt: isoUtc(status.lastCollectorErrorAtMs),
    },
    history,
  };
}

/** Public errors are codes only; never serialize an internal error message. */
export function buildPublicErrorEnvelope(code = 'invalid_request') {
  return { error: { code: PUBLIC_ERROR_CODES.includes(code) ? code : 'internal_error' } };
}
