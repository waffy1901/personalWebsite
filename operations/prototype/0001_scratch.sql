-- ONLY the disposable prototype database; never apply to operational storage.
CREATE TABLE prototype_samples (
  slot INTEGER PRIMARY KEY,
  observed_at_ms INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  duration_ms REAL NOT NULL,
  confirmation_json TEXT
) STRICT;
CREATE INDEX prototype_observed ON prototype_samples(observed_at_ms);
CREATE INDEX prototype_outcome_slot ON prototype_samples(outcome, slot);
