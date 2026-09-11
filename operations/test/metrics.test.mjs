import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONFIRMATION_GRACE_MS,
  MAX_OBSERVATIONS,
  SLOT_MS,
  SLOW_MS,
  STALE_MS,
  calculateAvailability,
  calculateStatus,
} from '../src/metrics.mjs';

const BASE = Math.floor(Date.UTC(2026, 8, 10, 12, 0, 0) / SLOT_MS) * SLOT_MS;
const at = (slot, outcome = 'success', latencyMs = 100, kind = 'primary') => ({
  scheduledAtMs: BASE + slot * SLOT_MS,
  completedAtMs: BASE + slot * SLOT_MS + 10,
  outcome,
  latencyMs,
  kind,
});
const openFromBase = [{ startMs: BASE, endMs: null }];
const windowFor = (endSlot) => ({ key: '24h', startMs: BASE, endMs: BASE + endSlot * SLOT_MS });

test('empty history and monitoring-before-start have null percentages and unknown status', () => {
  const nowMs = BASE + 4 * SLOT_MS;
  const availability = calculateAvailability({
    observations: [], enabledPeriods: [{ startMs: BASE + 5 * SLOT_MS, endMs: null }], nowMs, window: windowFor(4),
  });
  assert.equal(availability.expectedPrimary, 0);
  assert.equal(availability.availabilityPercent, null);
  assert.equal(availability.coveragePercent, null);
  assert.equal(calculateStatus({ observations: [], enabledPeriods: openFromBase, nowMs }).state, 'unknown');
});

test('status is unknown when monitoring is disabled and never inherits an earlier period', () => {
  const disabled = calculateStatus({
    observations: [at(0)], enabledPeriods: [{ startMs: BASE, endMs: BASE + SLOT_MS }], nowMs: BASE + SLOT_MS,
  });
  assert.deepEqual([disabled.state, disabled.reason], ['unknown', 'monitoring_disabled']);
  const beforeStart = calculateStatus({
    observations: [], enabledPeriods: [{ startMs: BASE + SLOT_MS, endMs: null }], nowMs: BASE,
  });
  assert.deepEqual([beforeStart.state, beforeStart.reason], ['unknown', 'no_monitoring_data']);
  const restarted = calculateStatus({
    observations: [at(0, 'failure', undefined), at(1, 'failure', undefined), at(3)],
    enabledPeriods: [{ startMs: BASE, endMs: BASE + 2 * SLOT_MS }, { startMs: BASE + 3 * SLOT_MS, endMs: null }],
    nowMs: BASE + 3 * SLOT_MS + 100,
  });
  assert.deepEqual([restarted.state, restarted.reason], ['operational', 'fresh_success']);
});

test('status gap warnings include initial and entirely unobserved enabled slots', () => {
  const initialGap = calculateStatus({ observations: [], enabledPeriods: openFromBase, nowMs: BASE + SLOT_MS });
  assert.equal(initialGap.hasGapWarning, true);
  const newlyEnabledGap = calculateStatus({
    observations: [at(0)],
    enabledPeriods: [{ startMs: BASE, endMs: BASE + SLOT_MS }, { startMs: BASE + 2 * SLOT_MS, endMs: null }],
    nowMs: BASE + 3 * SLOT_MS,
  });
  assert.equal(newlyEnabledGap.hasGapWarning, true);
  assert.equal(newlyEnabledGap.reason, 'no_observations');
});

test('availability distinguishes completed probes, enabled-slot coverage, and disabled periods', () => {
  const nowMs = BASE + 7 * SLOT_MS;
  const enabledPeriods = [
    { startMs: BASE, endMs: BASE + 2 * SLOT_MS },
    { startMs: BASE + 4 * SLOT_MS, endMs: null },
  ];
  const availability = calculateAvailability({
    observations: [at(0), at(1, 'failure'), at(2), at(4)],
    enabledPeriods, nowMs, window: windowFor(7),
  });
  assert.deepEqual({
    successful: availability.successfulPrimary,
    completed: availability.completedPrimary,
    expected: availability.expectedPrimary,
    missing: availability.missingPrimary,
    disabled: availability.ignored.disabled,
  }, { successful: 2, completed: 3, expected: 5, missing: 2, disabled: 1 });
  assert.equal(availability.availabilityPercent, (2 / 3) * 100);
  assert.equal(availability.coveragePercent, 60);
  assert.equal(availability.gaps.hasGaps, true);
});

test('the completion grace is exact and a current completed slot stays out until its deadline', () => {
  const slot = BASE;
  const params = { observations: [at(0)], enabledPeriods: openFromBase };
  assert.equal(calculateAvailability({
    ...params, nowMs: slot + CONFIRMATION_GRACE_MS - 1,
    window: { key: '24h', startMs: slot, endMs: slot + CONFIRMATION_GRACE_MS - 1 },
  }).expectedPrimary, 0);
  const atDeadline = calculateAvailability({
    ...params, nowMs: slot + CONFIRMATION_GRACE_MS,
    window: { key: '24h', startMs: slot, endMs: slot + CONFIRMATION_GRACE_MS },
  });
  assert.equal(atDeadline.expectedPrimary, 1);
  assert.equal(atDeadline.completedPrimary, 1);
});

test('confirmation retries do not erase a failed primary observation', () => {
  const nowMs = BASE + SLOT_MS;
  const observations = [at(0, 'failure', undefined), at(0, 'success', 50, 'confirmation')];
  const availability = calculateAvailability({ observations, enabledPeriods: openFromBase, nowMs, window: windowFor(1) });
  assert.equal(availability.successfulPrimary, 0);
  assert.equal(availability.completedPrimary, 1);
  assert.equal(calculateStatus({ observations, enabledPeriods: openFromBase, nowMs }).reason, 'first_failure');
});

test('scheduled slots permit ordinary scheduler delay and a late confirmation completion', () => {
  const nowMs = BASE + SLOT_MS;
  const delayedPrimary = {
    ...at(0), completedAtMs: BASE + 20_000, latencyMs: 125,
  };
  const delayedConfirmation = {
    ...at(0, 'success', 80, 'confirmation'), completedAtMs: BASE + 15_000,
  };
  assert.equal(calculateStatus({ observations: [delayedPrimary], enabledPeriods: openFromBase, nowMs }).reason, 'fresh_success');
  const availability = calculateAvailability({
    observations: [at(0, 'failure', undefined), delayedConfirmation], enabledPeriods: openFromBase, nowMs, window: windowFor(1),
  });
  assert.deepEqual([availability.successfulPrimary, availability.completedPrimary], [0, 1]);
});

test('slow and stale boundaries are inclusive and slowMs is bounded configuration', () => {
  const slowNow = BASE + SLOT_MS;
  assert.deepEqual(
    calculateStatus({ observations: [at(0, 'success', SLOW_MS)], enabledPeriods: openFromBase, nowMs: slowNow }).state,
    'degraded',
  );
  assert.equal(
    calculateStatus({ observations: [at(0, 'success', 750)], enabledPeriods: openFromBase, nowMs: slowNow, slowMs: 750 }).reason,
    'slow_response',
  );
  assert.throws(() => calculateStatus({ observations: [at(0)], enabledPeriods: openFromBase, nowMs: slowNow, slowMs: 10_001 }), /slowMs/);
  const staleNow = BASE + STALE_MS + 10;
  assert.deepEqual(
    calculateStatus({ observations: [at(0)], enabledPeriods: openFromBase, nowMs: staleNow }).reason,
    'stale',
  );
});

test('scheduled primary state transitions require consecutive evidence and two recovery successes', () => {
  const statusFor = (observations) => calculateStatus({
    observations, enabledPeriods: openFromBase,
    nowMs: observations.at(-1).completedAtMs + 100,
  });
  assert.equal(statusFor([at(0, 'failure', undefined)]).state, 'degraded');
  assert.equal(statusFor([at(0, 'failure', undefined), at(1, 'failure', undefined)]).state, 'down');
  assert.deepEqual(
    statusFor([at(0, 'failure', undefined), at(1, 'failure', undefined), at(2)]),
    {
      state: 'degraded', reason: 'recovery_awaiting_confirmation',
      lastObservationAtMs: BASE + 2 * SLOT_MS + 10, observationAgeMs: 100,
      lastLatencyMs: 100, lastCollectorErrorAtMs: null, hasGapWarning: false, slowMs: SLOW_MS,
      stateCheckpoint: {
        activePeriodStartMs: BASE, lastProcessedSlotMs: BASE + 2 * SLOT_MS,
        establishedDown: true, failureStreak: 0, recoveryStreak: 1,
      },
    },
  );
  assert.equal(
    statusFor([at(0, 'failure', undefined), at(1, 'failure', undefined), at(2), at(3)]).state,
    'operational',
  );
});

test('a down latch survives a missing slot but clears after confirmed recovery', () => {
  const statusFor = (observations) => calculateStatus({
    observations, enabledPeriods: openFromBase, nowMs: observations.at(-1).completedAtMs + 100,
  });
  assert.equal(statusFor([at(0, 'failure', undefined), at(1, 'failure', undefined), at(3)]).reason, 'recovery_awaiting_confirmation');
  assert.equal(statusFor([at(0, 'failure', undefined), at(1, 'failure', undefined), at(3), at(4)]).reason, 'fresh_success');
  assert.equal(statusFor([
    at(0, 'failure', undefined), at(1, 'failure', undefined), at(2), at(3),
    at(4, 'failure', undefined), at(5),
  ]).reason, 'fresh_success');
});

test('a validated checkpoint preserves the down latch across the raw-retention boundary', () => {
  const farSlot = (30 * 24 * 60 * 60 * 1_000 / SLOT_MS) + 1;
  const firstRecovery = calculateStatus({
    observations: [at(farSlot)], enabledPeriods: openFromBase, nowMs: BASE + farSlot * SLOT_MS + 100,
    stateCheckpoint: {
      activePeriodStartMs: BASE, lastProcessedSlotMs: BASE + SLOT_MS,
      establishedDown: true, failureStreak: 2, recoveryStreak: 0,
    },
  });
  assert.equal(firstRecovery.reason, 'recovery_awaiting_confirmation');
  assert.deepEqual(firstRecovery.stateCheckpoint, {
    activePeriodStartMs: BASE, lastProcessedSlotMs: BASE + farSlot * SLOT_MS,
    establishedDown: true, failureStreak: 0, recoveryStreak: 1,
  });
  const confirmed = calculateStatus({
    observations: [at(farSlot + 1)], enabledPeriods: openFromBase, nowMs: BASE + (farSlot + 1) * SLOT_MS + 100,
    stateCheckpoint: firstRecovery.stateCheckpoint,
  });
  assert.equal(confirmed.reason, 'fresh_success');
  assert.equal(confirmed.stateCheckpoint.establishedDown, false);
  const resetAtReenable = calculateStatus({
    observations: [at(farSlot)], enabledPeriods: openFromBase, nowMs: BASE + farSlot * SLOT_MS + 100,
    stateCheckpoint: { ...firstRecovery.stateCheckpoint, activePeriodStartMs: BASE + SLOT_MS },
  });
  assert.equal(resetAtReenable.reason, 'fresh_success');
});

test('a continuous outage can update a checkpoint indefinitely with a capped failure streak', () => {
  let status = calculateStatus({
    observations: [at(0, 'failure', undefined), at(1, 'failure', undefined)],
    enabledPeriods: openFromBase, nowMs: BASE + SLOT_MS + 100,
  });
  for (let slot = 2; slot < 10; slot += 1) {
    status = calculateStatus({
      observations: [at(slot, 'failure', undefined)], enabledPeriods: openFromBase,
      nowMs: BASE + slot * SLOT_MS + 100, stateCheckpoint: status.stateCheckpoint,
    });
    assert.equal(status.state, 'down');
    assert.deepEqual([status.stateCheckpoint.failureStreak, status.stateCheckpoint.recoveryStreak], [2, 0]);
  }
  assert.throws(() => calculateStatus({
    observations: [at(2)], enabledPeriods: openFromBase, nowMs: BASE + 2 * SLOT_MS + 100,
    stateCheckpoint: { ...status.stateCheckpoint, failureStreak: 1, recoveryStreak: 1 },
  }), /stateCheckpoint/);
});

test('gaps and disabled/re-enabled monitoring break consecutive state evidence', () => {
  assert.equal(
    calculateStatus({ observations: [at(0, 'failure', undefined), at(2, 'failure', undefined)], enabledPeriods: openFromBase, nowMs: BASE + 2 * SLOT_MS + 100 }).reason,
    'first_failure',
  );
  const periods = [{ startMs: BASE, endMs: BASE + SLOT_MS }, { startMs: BASE + SLOT_MS, endMs: null }];
  assert.equal(
    calculateStatus({ observations: [at(0, 'failure', undefined), at(1, 'failure', undefined)], enabledPeriods: periods, nowMs: BASE + SLOT_MS + 100 }).reason,
    'first_failure',
  );
});

test('collector errors are separate from target failures and make the current status unknown', () => {
  const nowMs = BASE + SLOT_MS;
  const status = calculateStatus({
    observations: [at(0)], enabledPeriods: openFromBase, nowMs,
    collectorErrors: [{ scheduledAtMs: BASE + SLOT_MS, completedAtMs: BASE + SLOT_MS }],
  });
  assert.equal(status.state, 'unknown');
  assert.equal(status.reason, 'collector_error');
  assert.equal(status.lastCollectorErrorAtMs, BASE + SLOT_MS);
});

test('collector errors outside monitoring or older than a completed observation do not hide it', () => {
  const nowMs = BASE + 2 * SLOT_MS;
  const status = calculateStatus({
    observations: [at(1)], enabledPeriods: openFromBase, nowMs,
    collectorErrors: [{ scheduledAtMs: BASE, completedAtMs: BASE + 20 }],
  });
  assert.equal(status.reason, 'fresh_success');
  const disabledError = calculateStatus({
    observations: [at(2)], enabledPeriods: [{ startMs: BASE + 2 * SLOT_MS, endMs: null }], nowMs: BASE + 2 * SLOT_MS + 100,
    collectorErrors: [{ scheduledAtMs: BASE + SLOT_MS, completedAtMs: BASE + SLOT_MS }],
  });
  assert.equal(disabledError.reason, 'fresh_success');
});

test('duplicate primary records and invalid future or off-grid records are rejected; array order is immaterial', () => {
  const nowMs = BASE + 3 * SLOT_MS;
  assert.throws(() => calculateAvailability({
    observations: [at(0), at(0, 'failure', undefined)], enabledPeriods: openFromBase, nowMs, window: windowFor(3),
  }), /duplicate primary/);
  assert.throws(() => calculateStatus({
    observations: [{ ...at(0), scheduledAtMs: BASE + 1 },], enabledPeriods: openFromBase, nowMs,
  }), /timestamp/);
  assert.throws(() => calculateStatus({
    observations: [{ ...at(4), completedAtMs: BASE + 4 * SLOT_MS + 10 }], enabledPeriods: openFromBase, nowMs,
  }), /order/);
  assert.equal(calculateStatus({
    observations: [at(1, 'failure', undefined), at(0, 'failure', undefined)], enabledPeriods: openFromBase, nowMs,
  }).state, 'down');
  assert.throws(() => calculateStatus({
    observations: Array.from({ length: MAX_OBSERVATIONS + 1 }, () => at(0)), enabledPeriods: openFromBase, nowMs,
  }), /too many observations/);
  assert.throws(() => calculateAvailability({
    observations: [], enabledPeriods: openFromBase, nowMs, window: { startMs: -1, endMs: nowMs },
  }), /invalid window/);
});
