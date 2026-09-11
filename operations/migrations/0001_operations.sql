-- Additive initial schema. D1 enables foreign keys for all statements.
-- UTC instants are integer milliseconds. No seed or synthetic monitoring data.
CREATE TABLE services (
  id TEXT PRIMARY KEY CHECK (id = 'portfolio'),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
) STRICT;

CREATE TABLE service_configs (
  service_id TEXT NOT NULL REFERENCES services(id),
  version INTEGER NOT NULL CHECK (version > 0),
  target_key TEXT NOT NULL CHECK (target_key = 'portfolio'),
  cadence_ms INTEGER NOT NULL DEFAULT 300000 CHECK (cadence_ms = 300000),
  timeout_ms INTEGER NOT NULL DEFAULT 10000 CHECK (timeout_ms = 10000),
  confirmation_retries INTEGER NOT NULL DEFAULT 1 CHECK (confirmation_retries BETWEEN 0 AND 1),
  slow_ms INTEGER NOT NULL DEFAULT 2000 CHECK (slow_ms > 0 AND slow_ms <= timeout_ms),
  stale_ms INTEGER NOT NULL DEFAULT 900000 CHECK (stale_ms = 900000),
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
  PRIMARY KEY (service_id, version)
) STRICT;
CREATE TRIGGER configs_immutable BEFORE UPDATE ON service_configs BEGIN
  SELECT RAISE(ABORT, 'Create a configuration version instead of rewriting history');
END;

-- Only enabled periods are recorded. Disabled time is the space between periods.
CREATE TABLE monitoring_periods (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  config_version INTEGER NOT NULL,
  starts_at_ms INTEGER NOT NULL CHECK (starts_at_ms >= 0),
  ends_at_ms INTEGER CHECK (ends_at_ms > starts_at_ms),
  UNIQUE (service_id, starts_at_ms),
  FOREIGN KEY (service_id, config_version) REFERENCES service_configs(service_id, version)
) STRICT;
CREATE INDEX monitoring_periods_service_time ON monitoring_periods(service_id, starts_at_ms);
CREATE TRIGGER periods_no_overlap_insert BEFORE INSERT ON monitoring_periods BEGIN
  SELECT RAISE(ABORT, 'Monitoring periods overlap') WHERE EXISTS (
    SELECT 1 FROM monitoring_periods WHERE service_id = NEW.service_id
      AND (ends_at_ms IS NULL OR NEW.starts_at_ms < ends_at_ms)
      AND (NEW.ends_at_ms IS NULL OR starts_at_ms < NEW.ends_at_ms)
  );
END;
CREATE TRIGGER periods_close_only BEFORE UPDATE ON monitoring_periods BEGIN
  SELECT RAISE(ABORT, 'Only closing an open monitoring period is allowed')
    WHERE NEW.id != OLD.id OR NEW.service_id != OLD.service_id
      OR NEW.config_version != OLD.config_version OR NEW.starts_at_ms != OLD.starts_at_ms
      OR OLD.ends_at_ms IS NOT NULL OR NEW.ends_at_ms IS NULL;
  SELECT RAISE(ABORT, 'Period would exclude existing observations') WHERE EXISTS (
    SELECT 1 FROM observations WHERE service_id = NEW.service_id
      AND scheduled_at_ms >= NEW.ends_at_ms AND scheduled_at_ms >= NEW.starts_at_ms
  );
END;

-- Keep unresolved outage state when older raw observations are retired.
-- The adapter atomically advances this private checkpoint with collection.
CREATE TABLE service_state_checkpoints (
  service_id TEXT PRIMARY KEY,
  active_period_start_ms INTEGER NOT NULL,
  last_processed_slot_ms INTEGER NOT NULL CHECK (
    last_processed_slot_ms >= active_period_start_ms AND last_processed_slot_ms % 300000 = 0),
  established_down INTEGER NOT NULL CHECK (established_down IN (0, 1)),
  failure_streak INTEGER NOT NULL CHECK (failure_streak BETWEEN 0 AND 2),
  recovery_streak INTEGER NOT NULL CHECK (recovery_streak BETWEEN 0 AND 1),
  updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= last_processed_slot_ms),
  FOREIGN KEY (service_id, active_period_start_ms) REFERENCES monitoring_periods(service_id, starts_at_ms),
  CHECK (established_down = 1 OR (failure_streak < 2 AND recovery_streak = 0)),
  CHECK (failure_streak = 0 OR recovery_streak = 0)
) STRICT;

CREATE TABLE collector_runs (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  config_version INTEGER NOT NULL,
  scheduled_at_ms INTEGER NOT NULL CHECK (scheduled_at_ms >= 0 AND scheduled_at_ms % 300000 = 0),
  started_at_ms INTEGER NOT NULL CHECK (started_at_ms >= scheduled_at_ms),
  finished_at_ms INTEGER CHECK (finished_at_ms >= started_at_ms),
  state TEXT NOT NULL CHECK (state IN ('started', 'completed', 'failed')),
  error_code TEXT CHECK (error_code IN ('storage', 'configuration', 'interrupted', 'internal')),
  FOREIGN KEY (service_id, config_version) REFERENCES service_configs(service_id, version),
  UNIQUE (id, service_id, config_version, scheduled_at_ms),
  CHECK ((state = 'started' AND finished_at_ms IS NULL AND error_code IS NULL)
    OR (state = 'completed' AND finished_at_ms IS NOT NULL AND error_code IS NULL)
    OR (state = 'failed' AND finished_at_ms IS NOT NULL AND error_code IS NOT NULL))
) STRICT;
CREATE INDEX collector_runs_service_slot ON collector_runs(service_id, scheduled_at_ms);
CREATE INDEX collector_runs_retention ON collector_runs(started_at_ms);

CREATE TABLE observations (
  service_id TEXT NOT NULL,
  scheduled_at_ms INTEGER NOT NULL CHECK (scheduled_at_ms >= 0 AND scheduled_at_ms % 300000 = 0),
  config_version INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  observed_at_ms INTEGER NOT NULL CHECK (observed_at_ms >= scheduled_at_ms),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'http_error', 'timeout', 'network_error', 'redirect_error')),
  http_status INTEGER,
  duration_ms REAL NOT NULL CHECK (duration_ms >= 0),
  PRIMARY KEY (service_id, scheduled_at_ms),
  FOREIGN KEY (run_id, service_id, config_version, scheduled_at_ms)
    REFERENCES collector_runs(id, service_id, config_version, scheduled_at_ms),
  CHECK ((outcome = 'success' AND http_status IS NOT NULL AND http_status BETWEEN 200 AND 299)
    OR (outcome = 'http_error' AND http_status IS NOT NULL AND http_status BETWEEN 400 AND 599)
    OR (outcome = 'redirect_error' AND http_status IS NOT NULL AND http_status BETWEEN 300 AND 399)
    OR (outcome IN ('timeout', 'network_error') AND http_status IS NULL))
) STRICT;
CREATE INDEX observations_retention ON observations(scheduled_at_ms);
CREATE INDEX observations_run ON observations(run_id);
CREATE TRIGGER observations_enabled BEFORE INSERT ON observations BEGIN
  SELECT RAISE(ABORT, 'Observation must belong to an enabled configuration period') WHERE NOT EXISTS (
    SELECT 1 FROM monitoring_periods WHERE service_id = NEW.service_id
      AND config_version = NEW.config_version AND starts_at_ms <= NEW.scheduled_at_ms
      AND (ends_at_ms IS NULL OR NEW.scheduled_at_ms < ends_at_ms)
  );
END;
CREATE TRIGGER observations_immutable BEFORE UPDATE ON observations BEGIN
  SELECT RAISE(ABORT, 'Primary observations are immutable');
END;

CREATE TABLE confirmation_observations (
  service_id TEXT NOT NULL,
  scheduled_at_ms INTEGER NOT NULL,
  observed_at_ms INTEGER NOT NULL CHECK (observed_at_ms >= scheduled_at_ms),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'http_error', 'timeout', 'network_error', 'redirect_error')),
  http_status INTEGER,
  duration_ms REAL NOT NULL CHECK (duration_ms >= 0),
  PRIMARY KEY (service_id, scheduled_at_ms),
  FOREIGN KEY (service_id, scheduled_at_ms) REFERENCES observations(service_id, scheduled_at_ms),
  CHECK ((outcome = 'success' AND http_status IS NOT NULL AND http_status BETWEEN 200 AND 299)
    OR (outcome = 'http_error' AND http_status IS NOT NULL AND http_status BETWEEN 400 AND 599)
    OR (outcome = 'redirect_error' AND http_status IS NOT NULL AND http_status BETWEEN 300 AND 399)
    OR (outcome IN ('timeout', 'network_error') AND http_status IS NULL))
) STRICT;
CREATE INDEX confirmations_retention ON confirmation_observations(scheduled_at_ms);
CREATE TRIGGER confirmations_immutable BEFORE UPDATE ON confirmation_observations BEGIN
  SELECT RAISE(ABORT, 'Confirmation observations are immutable');
END;

CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  provider TEXT NOT NULL CHECK (provider = 'netlify'),
  commit_sha TEXT CHECK (length(commit_sha) = 40 AND commit_sha NOT GLOB '*[^0-9a-f]*'),
  state TEXT NOT NULL CHECK (state IN ('pending', 'ready', 'failed', 'skipped')),
  first_seen_at_ms INTEGER NOT NULL CHECK (first_seen_at_ms >= 0),
  verified_at_ms INTEGER NOT NULL CHECK (verified_at_ms >= first_seen_at_ms),
  workflow_url TEXT,
  release_url TEXT,
  UNIQUE (id, service_id)
) STRICT;
CREATE INDEX deployments_retention ON deployments(verified_at_ms);
-- A ready deployment is not necessarily published. Every publication/rollback is separate.
CREATE TABLE deployment_publications (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  verified_at_ms INTEGER NOT NULL CHECK (verified_at_ms >= 0),
  FOREIGN KEY (deployment_id, service_id) REFERENCES deployments(id, service_id)
) STRICT;
CREATE INDEX publications_service_time ON deployment_publications(service_id, verified_at_ms);
CREATE INDEX publications_retention ON deployment_publications(verified_at_ms);
CREATE INDEX publications_deployment ON deployment_publications(deployment_id);
CREATE TABLE provider_sync_state (
  service_id TEXT PRIMARY KEY REFERENCES services(id),
  current_publication_id TEXT REFERENCES deployment_publications(id),
  attempted_at_ms INTEGER NOT NULL CHECK (attempted_at_ms >= 0),
  verified_at_ms INTEGER CHECK (verified_at_ms >= 0 AND verified_at_ms <= attempted_at_ms),
  error_code TEXT CHECK (error_code IN ('provider_unavailable', 'invalid_provenance'))
) STRICT;
CREATE TRIGGER publications_ready BEFORE INSERT ON deployment_publications BEGIN
  SELECT RAISE(ABORT, 'Published deployment needs a verified ready commit') WHERE NOT EXISTS (
    SELECT 1 FROM deployments WHERE id = NEW.deployment_id AND service_id = NEW.service_id
      AND state = 'ready' AND commit_sha IS NOT NULL
  );
END;
CREATE TRIGGER publications_immutable BEFORE UPDATE ON deployment_publications BEGIN
  SELECT RAISE(ABORT, 'Record a new publication instead of rewriting provenance');
END;
CREATE TRIGGER published_deployment_identity BEFORE UPDATE ON deployments BEGIN
  SELECT RAISE(ABORT, 'Published deployment identity is immutable')
    WHERE EXISTS (SELECT 1 FROM deployment_publications WHERE deployment_id = OLD.id)
      AND (NEW.id != OLD.id OR NEW.service_id != OLD.service_id
        OR NEW.commit_sha IS NOT OLD.commit_sha OR NEW.state != 'ready');
END;

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  state TEXT NOT NULL CHECK (state IN ('investigating', 'identified', 'monitoring', 'resolved')),
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
  resolved_at_ms INTEGER CHECK (resolved_at_ms >= created_at_ms),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((state = 'resolved' AND resolved_at_ms IS NOT NULL) OR (state != 'resolved' AND resolved_at_ms IS NULL))
) STRICT;
CREATE INDEX incidents_service_time ON incidents(service_id, created_at_ms);
CREATE INDEX incidents_retention ON incidents(resolved_at_ms);
CREATE TABLE incident_updates (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 4000),
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
) STRICT;
CREATE INDEX incident_updates_parent_time ON incident_updates(incident_id, created_at_ms);

CREATE TABLE maintenance_windows (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  starts_at_ms INTEGER NOT NULL CHECK (starts_at_ms >= 0),
  ends_at_ms INTEGER NOT NULL CHECK (ends_at_ms > starts_at_ms),
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
) STRICT;
CREATE INDEX maintenance_service_time ON maintenance_windows(service_id, starts_at_ms);
CREATE INDEX maintenance_retention ON maintenance_windows(ends_at_ms);

CREATE TABLE owner_audit_events (
  id TEXT PRIMARY KEY,
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK (action IN ('service_configure', 'monitoring_start', 'monitoring_stop', 'incident_create', 'incident_update', 'incident_resolve', 'maintenance_create', 'maintenance_update')),
  resource_id TEXT NOT NULL,
  occurred_at_ms INTEGER NOT NULL CHECK (occurred_at_ms >= 0),
  request_id TEXT NOT NULL
) STRICT;
CREATE INDEX audit_retention ON owner_audit_events(occurred_at_ms);
CREATE TRIGGER audit_immutable BEFORE UPDATE ON owner_audit_events BEGIN
  SELECT RAISE(ABORT, 'Audit events are append-only');
END;

-- Phase 2 materializes fixed-size public summaries after collection, never per visitor.
CREATE TABLE public_summaries (
  service_id TEXT NOT NULL REFERENCES services(id),
  window TEXT NOT NULL CHECK (window IN ('24h', '7d', '30d')),
  generated_at_ms INTEGER NOT NULL CHECK (generated_at_ms >= 0),
  latest_observed_at_ms INTEGER CHECK (latest_observed_at_ms >= 0 AND latest_observed_at_ms <= generated_at_ms),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json) AND length(CAST(payload_json AS BLOB)) <= 131072),
  PRIMARY KEY (service_id, window)
) STRICT;
