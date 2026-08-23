import assert from "node:assert/strict"
import test from "node:test"
import {
  ANALYTICS_HOSTS,
  FIRST_NAVIGATION_TARGETS,
  NAVIGATION_PROFILES,
  RUNS_PER_TARGET_PROFILE,
  aggregateNavigationRuns,
  installNavigationObservation,
  navigationRecordValidationErrors,
  validateNavigationPlan,
} from "./measure-first-navigation.mjs"

function completeRecord(overrides = {}) {
  return {
    status: "success",
    profile: "mobile",
    target: FIRST_NAVIGATION_TARGETS[0],
    runNumber: 1,
    activationToReadyMs: 350,
    fullPageFallbackExposureMs: 0,
    routeChunkBytes: 12_000,
    pendingAnnouncementCount: 1,
    analyticsBlocking: { enabled: true, measurementId: "", blockedHosts: ANALYTICS_HOSTS, observedRequests: [] },
    ...overrides,
  }
}

test("Issue #174 first-navigation plan is the approved five-target, two-profile, five-run matrix", () => {
  const plan = validateNavigationPlan()
  assert.equal(plan.plannedSuccessfulRuns, 50)
  assert.equal(plan.runs, RUNS_PER_TARGET_PROFILE)
  assert.deepEqual(plan.targets, FIRST_NAVIGATION_TARGETS)
  assert.deepEqual(plan.profiles, NAVIGATION_PROFILES)
})

test("first-navigation records require zero full-page fallback and analytics blocking", () => {
  assert.deepEqual(navigationRecordValidationErrors(completeRecord()), [])
  assert.match(navigationRecordValidationErrors(completeRecord({ fullPageFallbackExposureMs: 1 })).join(" "), /full-page route fallback/)
  assert.match(navigationRecordValidationErrors(completeRecord({ analyticsBlocking: { enabled: false, measurementId: "", observedRequests: [] } })).join(" "), /analytics-disabled/)
  assert.match(navigationRecordValidationErrors(completeRecord({ pendingAnnouncementCount: 2 })).join(" "), /pending announcement/)
})

test("first-navigation observations retain distinct pending announcements after removal", () => {
  const originalDocument = globalThis.document
  const originalMutationObserver = globalThis.MutationObserver
  const originalWindow = globalThis.window
  const observers = []
  const pendingAnnouncement = { matches: (selector) => selector === "[data-route-transition-pending]", querySelectorAll: () => [] }
  const secondPendingAnnouncement = { matches: (selector) => selector === "[data-route-transition-pending]", querySelectorAll: () => [] }
  const body = { matches: () => false, querySelectorAll: () => [] }
  try {
    globalThis.document = { body, querySelector: () => null }
    globalThis.window = globalThis
    globalThis.MutationObserver = class {
      constructor(callback) {
        this.callback = callback
        observers.push(this)
      }

      observe() {}
      disconnect() {}
    }
    installNavigationObservation()
    const observation = globalThis.__issue174NavigationObservation
    observers[0].callback([{ type: "childList", addedNodes: [pendingAnnouncement] }])
    assert.equal(observation.state.pendingAnnouncementCount, 1)
    observers[0].callback([{ type: "childList", addedNodes: [] }])
    observation.sample()
    assert.equal(observation.state.pendingAnnouncementCount, 1)
    observers[0].callback([{ type: "childList", addedNodes: [pendingAnnouncement] }])
    assert.equal(observation.state.pendingAnnouncementCount, 1)
    observers[0].callback([{ type: "childList", addedNodes: [secondPendingAnnouncement] }])
    assert.equal(observation.state.pendingAnnouncementCount, 2)
    assert.match(navigationRecordValidationErrors(completeRecord({ pendingAnnouncementCount: observation.state.pendingAnnouncementCount })).join(" "), /pending announcement/)
  } finally {
    globalThis.document = originalDocument
    globalThis.MutationObserver = originalMutationObserver
    globalThis.window = originalWindow
    delete globalThis.__issue174NavigationObservation
  }
})

test("first-navigation aggregation reports median route readiness and route chunk bytes", () => {
  const aggregates = aggregateNavigationRuns([
    completeRecord({ activationToReadyMs: 300, routeChunkBytes: 10_000 }),
    completeRecord({ activationToReadyMs: 500, routeChunkBytes: 14_000, runNumber: 2 }),
  ])
  assert.equal(aggregates.length, 1)
  assert.equal(aggregates[0].median.activationToReadyMs, 400)
  assert.equal(aggregates[0].median.routeChunkBytes, 12_000)
  assert.equal(aggregates[0].maximum.fullPageFallbackExposureMs, 0)
})
