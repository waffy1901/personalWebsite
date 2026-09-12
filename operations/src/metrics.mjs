export const SLOT_MS = 5 * 60 * 1_000;
export const CONFIRMATION_GRACE_MS = 20 * 1_000;
export const PROBE_TIMEOUT_MS = 10 * 1_000;
export const SLOW_MS = 2_000;
export const STALE_MS = 15 * 60 * 1_000;
export const MAX_SLOW_MS = 10_000;
export const RAW_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const MAX_RAW_SLOTS = (RAW_RETENTION_MS / SLOT_MS) + 1;
export const MAX_OBSERVATIONS = MAX_RAW_SLOTS * 2;
export const MAX_COLLECTOR_ERRORS = MAX_RAW_SLOTS;

function isInteger(value) {
  return Number.isSafeInteger(value);
}

function isEpochMillis(value) {
  return isInteger(value) && value >= 0;
}

function fail(message) {
  throw new TypeError(message);
}

function valueAt(record, ...names) {
  for (const name of names) {
    if (Object.hasOwn(record, name)) return record[name];
  }
  return undefined;
}

function normalizePeriod(period, index) {
  if (!period || typeof period !== 'object') fail(`invalid enabled period ${index}`);
  const startMs = valueAt(period, 'startMs', 'startsAt');
  const endMs = valueAt(period, 'endMs', 'endsAt');
  if (!isEpochMillis(startMs) || (endMs !== null && endMs !== undefined && !isEpochMillis(endMs))) {
    fail(`invalid enabled period ${index}`);
  }
  if (endMs !== null && endMs !== undefined && endMs <= startMs) fail(`empty enabled period ${index}`);
  return { startMs, endMs: endMs ?? null };
}

/** Enabled periods are ordered, non-overlapping half-open [startMs, endMs). */
export function validateEnabledPeriods(enabledPeriods = []) {
  if (!Array.isArray(enabledPeriods)) fail('enabledPeriods must be an array');
  const periods = enabledPeriods.map(normalizePeriod);
  for (let index = 1; index < periods.length; index += 1) {
    const previous = periods[index - 1];
    const current = periods[index];
    if (previous.endMs === null || current.startMs < previous.endMs) {
      fail('enabled periods must be ordered and non-overlapping');
    }
  }
  return periods;
}

function isGridSlot(timestamp) {
  return timestamp % SLOT_MS === 0;
}

function periodIndexAt(periods, timestamp) {
  return periods.findIndex(({ startMs, endMs }) => timestamp >= startMs && (endMs === null || timestamp < endMs));
}

function validateObservation(record, nowMs, index) {
  if (!record || typeof record !== 'object') fail(`invalid observation ${index}`);
  const scheduledAtMs = valueAt(record, 'scheduledAtMs', 'scheduledAt');
  const completedAtMs = valueAt(record, 'completedAtMs', 'completedAt', 'observedAtMs', 'observedAt');
  const outcome = record.outcome;
  const kind = valueAt(record, 'kind', 'probeType') ?? 'primary';
  const latencyMs = valueAt(record, 'latencyMs', 'durationMs');
  if (!isEpochMillis(scheduledAtMs) || !isEpochMillis(completedAtMs) || !isGridSlot(scheduledAtMs)) {
    fail(`invalid observation timestamp ${index}`);
  }
  if (completedAtMs < scheduledAtMs || completedAtMs > nowMs || scheduledAtMs > nowMs) {
    fail(`invalid observation order ${index}`);
  }
  if (kind !== 'primary' && kind !== 'confirmation') fail(`invalid observation kind ${index}`);
  if (outcome !== 'success' && outcome !== 'failure') fail(`invalid observation outcome ${index}`);
  if (outcome === 'success' && (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > PROBE_TIMEOUT_MS)) {
    fail(`invalid successful latency ${index}`);
  }
  return { scheduledAtMs, completedAtMs, outcome, kind, latencyMs: Number.isFinite(latencyMs) ? latencyMs : null };
}

function validateObservations(observations = [], nowMs) {
  if (!Array.isArray(observations)) fail('observations must be an array');
  if (observations.length > MAX_OBSERVATIONS) fail('too many observations');
  const normalized = observations.map((record, index) => validateObservation(record, nowMs, index));
  const primarySlots = new Set();
  for (const observation of normalized) {
    if (observation.kind !== 'primary') continue;
    if (primarySlots.has(observation.scheduledAtMs)) fail('duplicate primary observation');
    primarySlots.add(observation.scheduledAtMs);
  }
  return normalized.sort((left, right) => left.scheduledAtMs - right.scheduledAtMs || left.completedAtMs - right.completedAtMs);
}

function normalizeWindow(window, nowMs) {
  if (!window || typeof window !== 'object') fail('window is required');
  const startMs = valueAt(window, 'startMs', 'startAtMs');
  const endMs = valueAt(window, 'endMs', 'endAtMs');
  if (!isEpochMillis(startMs) || !isEpochMillis(endMs) || startMs >= endMs || endMs > nowMs
    || endMs - startMs > RAW_RETENTION_MS) fail('invalid window');
  return { key: window.key ?? null, startMs, endMs };
}

function firstSlotAtOrAfter(timestamp) {
  return Math.ceil(timestamp / SLOT_MS) * SLOT_MS;
}

/**
 * Enumerate a bounded report window. A slot is expected only after its
 * completion deadline (scheduledAtMs + CONFIRMATION_GRACE_MS), so an in-flight
 * current slot is never marked missing even if it happened to finish early.
 */
function expectedSlots(periods, window, nowMs) {
  const slots = [];
  for (let periodIndex = 0; periodIndex < periods.length; periodIndex += 1) {
    const period = periods[periodIndex];
    const start = Math.max(period.startMs, window.startMs);
    const end = Math.min(period.endMs ?? window.endMs, window.endMs);
    for (let slot = firstSlotAtOrAfter(start); slot < end; slot += SLOT_MS) {
      if (slot + CONFIRMATION_GRACE_MS <= nowMs) slots.push({ slot, periodIndex });
    }
  }
  return slots;
}

function percent(numerator, denominator) {
  return denominator === 0 ? null : (numerator / denominator) * 100;
}

export function calculateAvailability({ observations = [], enabledPeriods = [], nowMs, window }) {
  if (!isEpochMillis(nowMs)) fail('nowMs must be a nonnegative integer');
  const periods = validateEnabledPeriods(enabledPeriods);
  const selectedWindow = normalizeWindow(window, nowMs);
  const primary = validateObservations(observations, nowMs).filter(({ kind }) => kind === 'primary');
  const expected = expectedSlots(periods, selectedWindow, nowMs);
  const expectedBySlot = new Map(expected.map(({ slot, periodIndex }) => [slot, periodIndex]));
  const completed = [];
  let ignoredDisabled = 0;
  let ignoredOutOfWindow = 0;
  let ignoredUnsettled = 0;

  for (const observation of primary) {
    if (observation.scheduledAtMs < selectedWindow.startMs || observation.scheduledAtMs >= selectedWindow.endMs) {
      ignoredOutOfWindow += 1;
    } else if (expectedBySlot.has(observation.scheduledAtMs)) {
      completed.push(observation);
    } else if (periodIndexAt(periods, observation.scheduledAtMs) === -1) {
      ignoredDisabled += 1;
    } else {
      ignoredUnsettled += 1;
    }
  }

  const completedSlots = new Set(completed.map(({ scheduledAtMs }) => scheduledAtMs));
  const missingSlots = expected.filter(({ slot }) => !completedSlots.has(slot)).map(({ slot }) => slot);
  const successfulPrimary = completed.filter(({ outcome }) => outcome === 'success').length;
  const completedPrimary = completed.length;
  const expectedPrimary = expected.length;
  const missingPrimary = missingSlots.length;

  return {
    window: selectedWindow,
    successfulPrimary,
    completedPrimary,
    expectedPrimary,
    missingPrimary,
    availabilityPercent: percent(successfulPrimary, completedPrimary),
    coveragePercent: percent(completedPrimary, expectedPrimary),
    gaps: {
      hasGaps: missingPrimary > 0,
      lastMissingSlotAtMs: missingSlots.at(-1) ?? null,
    },
    ignored: { disabled: ignoredDisabled, outOfWindow: ignoredOutOfWindow, unsettled: ignoredUnsettled },
  };
}

function validateCollectorErrors(errors = [], nowMs) {
  if (!Array.isArray(errors)) fail('collectorErrors must be an array');
  if (errors.length > MAX_COLLECTOR_ERRORS) fail('too many collector errors');
  return errors.map((error, index) => {
    if (!error || typeof error !== 'object') fail(`invalid collector error ${index}`);
    const scheduledAtMs = valueAt(error, 'scheduledAtMs', 'scheduledAt');
    const completedAtMs = valueAt(error, 'completedAtMs', 'completedAt', 'occurredAtMs', 'occurredAt');
    if (!isEpochMillis(scheduledAtMs) || !isEpochMillis(completedAtMs) || !isGridSlot(scheduledAtMs) || completedAtMs < scheduledAtMs || completedAtMs > nowMs) {
      fail(`invalid collector error ${index}`);
    }
    return { scheduledAtMs, completedAtMs };
  }).sort((left, right) => left.completedAtMs - right.completedAtMs || left.scheduledAtMs - right.scheduledAtMs);
}

function hasPreviousExpectedSlot(previous, current, periods) {
  if (current.scheduledAtMs !== previous.scheduledAtMs + SLOT_MS) return false;
  const previousPeriod = periodIndexAt(periods, previous.scheduledAtMs);
  const currentPeriod = periodIndexAt(periods, current.scheduledAtMs);
  return previousPeriod !== -1 && previousPeriod === currentPeriod;
}

function gapWarning(primary, expected) {
  const completedSlots = new Set(primary.map(({ scheduledAtMs }) => scheduledAtMs));
  return expected.some(({ slot }) => !completedSlots.has(slot));
}

function statusMonitoringReason(periods, nowMs) {
  if (periods.some((period) => period.startMs <= nowMs)) return 'monitoring_disabled';
  return 'no_monitoring_data';
}

function validateSlowMs(slowMs) {
  if (!isInteger(slowMs) || slowMs < 1 || slowMs > MAX_SLOW_MS) fail('invalid slowMs');
  return slowMs;
}

function normalizeStateCheckpoint(checkpoint, activePeriod, nowMs) {
  if (checkpoint === null || checkpoint === undefined) {
    return { lastProcessedSlotMs: null, establishedDown: false, failureStreak: 0, recoveryStreak: 0 };
  }
  if (!checkpoint || typeof checkpoint !== 'object') fail('invalid stateCheckpoint');
  const {
    activePeriodStartMs,
    lastProcessedSlotMs,
    establishedDown,
    failureStreak,
    recoveryStreak,
  } = checkpoint;
  if (!isEpochMillis(activePeriodStartMs)
    || !isEpochMillis(lastProcessedSlotMs)
    || !isGridSlot(lastProcessedSlotMs)
    || lastProcessedSlotMs < activePeriodStartMs
    || lastProcessedSlotMs > nowMs
    || typeof establishedDown !== 'boolean'
    || !isInteger(failureStreak) || failureStreak < 0 || failureStreak > 2
    || !isInteger(recoveryStreak) || recoveryStreak < 0 || recoveryStreak > 1
    || (failureStreak > 0 && recoveryStreak > 0)
    || (!establishedDown && recoveryStreak !== 0)
    || (!establishedDown && failureStreak >= 2)) {
    fail('invalid stateCheckpoint');
  }
  // A checkpoint from a disabled/re-enabled period is valid historical state,
  // but intentionally cannot influence the new period.
  if (activePeriodStartMs !== activePeriod.startMs) {
    return { lastProcessedSlotMs: null, establishedDown: false, failureStreak: 0, recoveryStreak: 0 };
  }
  if (activePeriod.endMs !== null && lastProcessedSlotMs >= activePeriod.endMs) fail('invalid stateCheckpoint');
  return { lastProcessedSlotMs, establishedDown, failureStreak, recoveryStreak };
}

function advanceState(primary, periods, checkpoint) {
  let { lastProcessedSlotMs, establishedDown, failureStreak, recoveryStreak } = checkpoint;
  let previous = lastProcessedSlotMs === null ? null : { scheduledAtMs: lastProcessedSlotMs };

  for (const observation of primary) {
    if (lastProcessedSlotMs !== null && observation.scheduledAtMs <= lastProcessedSlotMs) continue;
    const consecutive = previous !== null && hasPreviousExpectedSlot(previous, observation, periods);
    if (!consecutive) {
      failureStreak = 0;
      recoveryStreak = 0;
    }
    if (observation.outcome === 'failure') {
      failureStreak = consecutive ? Math.min(2, failureStreak + 1) : 1;
      recoveryStreak = 0;
      if (failureStreak >= 2) establishedDown = true;
    } else {
      failureStreak = 0;
      recoveryStreak = establishedDown ? (consecutive ? recoveryStreak + 1 : 1) : 0;
      if (establishedDown && recoveryStreak >= 2) {
        establishedDown = false;
        recoveryStreak = 0;
      }
    }
    previous = observation;
    lastProcessedSlotMs = observation.scheduledAtMs;
  }

  return { lastProcessedSlotMs, establishedDown, failureStreak, recoveryStreak };
}

function publicCheckpoint(activePeriod, state) {
  if (state.lastProcessedSlotMs === null) return null;
  return {
    activePeriodStartMs: activePeriod.startMs,
    lastProcessedSlotMs: state.lastProcessedSlotMs,
    establishedDown: state.establishedDown,
    failureStreak: state.failureStreak,
    recoveryStreak: state.recoveryStreak,
  };
}

/**
 * Calculate current service state from primary scheduled observations only.
 * Confirmation retries are retained for diagnostics by storage but cannot
 * change availability, failure streaks, or recovery streaks.
 */
export function calculateStatus({
  observations = [], collectorErrors = [], enabledPeriods = [], nowMs, slowMs = SLOW_MS, stateCheckpoint = null,
}) {
  if (!isEpochMillis(nowMs)) fail('nowMs must be a nonnegative integer');
  const configuredSlowMs = validateSlowMs(slowMs);
  const periods = validateEnabledPeriods(enabledPeriods);
  const allObservations = validateObservations(observations, nowMs);
  const allErrors = validateCollectorErrors(collectorErrors, nowMs);
  const activePeriodIndex = periodIndexAt(periods, nowMs);
  if (activePeriodIndex === -1) {
    return {
      state: 'unknown', reason: statusMonitoringReason(periods, nowMs), lastObservationAtMs: null,
      observationAgeMs: null, lastLatencyMs: null, lastCollectorErrorAtMs: null,
      hasGapWarning: false, slowMs: configuredSlowMs, stateCheckpoint: null,
    };
  }
  const statusWindow = { startMs: Math.max(0, nowMs - RAW_RETENTION_MS), endMs: nowMs };
  const primary = allObservations.filter((observation) => (
    observation.kind === 'primary'
    && observation.scheduledAtMs >= statusWindow.startMs
    && periodIndexAt(periods, observation.scheduledAtMs) === activePeriodIndex
  ));
  const errors = allErrors.filter((error) => (
    error.scheduledAtMs >= statusWindow.startMs
    && periodIndexAt(periods, error.scheduledAtMs) === activePeriodIndex
  ));
  const expected = expectedSlots(periods, statusWindow, nowMs)
    .filter(({ periodIndex }) => periodIndex === activePeriodIndex);
  const checkpoint = normalizeStateCheckpoint(stateCheckpoint, periods[activePeriodIndex], nowMs);
  const state = advanceState(primary, periods, checkpoint);
  const latest = primary.at(-1) ?? null;
  const latestError = errors.at(-1) ?? null;
  const lastCollectorErrorAtMs = latestError?.completedAtMs ?? null;

  const base = {
    lastObservationAtMs: latest?.completedAtMs ?? null,
    observationAgeMs: latest ? nowMs - latest.completedAtMs : null,
    lastLatencyMs: latest?.latencyMs ?? null,
    lastCollectorErrorAtMs,
    hasGapWarning: gapWarning(primary, expected),
    slowMs: configuredSlowMs,
    stateCheckpoint: publicCheckpoint(periods[activePeriodIndex], state),
  };

  if (!latest && latestError) return { state: 'unknown', reason: 'collector_error', ...base };
  if (!latest) return { state: 'unknown', reason: 'no_observations', ...base };
  if (latestError && latestError.completedAtMs >= latest.completedAtMs) {
    return { state: 'unknown', reason: 'collector_error', ...base };
  }
  if (base.observationAgeMs >= STALE_MS) return { state: 'unknown', reason: 'stale', ...base };

  if (latest.outcome === 'failure') {
    return state.establishedDown || state.failureStreak >= 2
      ? { state: 'down', reason: 'consecutive_failures', ...base }
      : { state: 'degraded', reason: 'first_failure', ...base };
  }
  if (state.establishedDown && state.recoveryStreak < 2) {
    return { state: 'degraded', reason: 'recovery_awaiting_confirmation', ...base };
  }
  if (latest.latencyMs >= configuredSlowMs) return { state: 'degraded', reason: 'slow_response', ...base };
  return { state: 'operational', reason: 'fresh_success', ...base };
}
