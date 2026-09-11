export const RAW_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const EVENT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
export const CLEANUP_BATCH_SIZE = 100;

// Each statement deletes at most 100 rows. Child rows go first; no cascading deletes.
// Phase 2 must schedule this independently of dashboard requests and log failures.
export function retentionStatements(nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('Invalid cleanup time');
  const rawCutoff = nowMs - RAW_RETENTION_MS;
  const eventCutoff = nowMs - EVENT_RETENTION_MS;
  const rules = [
    ['confirmation_observations', 'scheduled_at_ms < ?', rawCutoff, 'scheduled_at_ms'],
    ['observations', `scheduled_at_ms < ? AND NOT EXISTS (
      SELECT 1 FROM confirmation_observations c WHERE c.service_id = observations.service_id
        AND c.scheduled_at_ms = observations.scheduled_at_ms)`, rawCutoff, 'scheduled_at_ms'],
    ['collector_runs', `started_at_ms < ? AND NOT EXISTS (
      SELECT 1 FROM observations o WHERE o.run_id = collector_runs.id)`, rawCutoff, 'started_at_ms'],
    ['incident_updates', `incident_id IN (SELECT id FROM incidents WHERE resolved_at_ms < ?)`, eventCutoff, 'incident_id, created_at_ms'],
    ['incidents', `resolved_at_ms < ? AND NOT EXISTS (
      SELECT 1 FROM incident_updates u WHERE u.incident_id = incidents.id)`, eventCutoff, 'resolved_at_ms'],
    ['deployment_publications', `verified_at_ms < ? AND id NOT IN (
      SELECT id FROM deployment_publications ORDER BY verified_at_ms DESC, id DESC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM provider_sync_state s WHERE s.current_publication_id = deployment_publications.id)`, eventCutoff, 'verified_at_ms'],
    ['deployments', `verified_at_ms < ? AND NOT EXISTS (
      SELECT 1 FROM deployment_publications p WHERE p.deployment_id = deployments.id)`, eventCutoff, 'verified_at_ms'],
    ['maintenance_windows', 'ends_at_ms < ?', eventCutoff, 'ends_at_ms'],
    ['owner_audit_events', 'occurred_at_ms < ?', eventCutoff, 'occurred_at_ms'],
  ];
  return rules.map(([table, condition, cutoff, order]) => ({
    sql: `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${condition} ORDER BY ${order} LIMIT ?)`,
    bindings: [cutoff, CLEANUP_BATCH_SIZE],
  }));
}
