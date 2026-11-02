-- Migration number: 0002 	 2026-11-02T04:00:00.000Z

-- A voided entry stays in the table (and its audit trail) but leaves the register.
ALTER TABLE movements ADD COLUMN voided_at TEXT;
ALTER TABLE movements ADD COLUMN voided_by INTEGER REFERENCES staff(id);
ALTER TABLE movements ADD COLUMN void_reason TEXT;

DROP INDEX one_open_per_staff;
CREATE UNIQUE INDEX one_open_per_staff ON movements(staff_id) WHERE time_in IS NULL AND voided_at IS NULL;

-- Staff ask in the app; an admin approves (which creates the movement) or rejects.
CREATE TABLE permission_requests (
  id             INTEGER PRIMARY KEY,
  staff_id       INTEGER NOT NULL REFERENCES staff(id),
  purpose        TEXT NOT NULL,
  place          TEXT,
  requested_from INTEGER NOT NULL REFERENCES staff(id),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by     INTEGER REFERENCES staff(id),
  decided_at     TEXT,
  decision_note  TEXT,
  movement_id    INTEGER REFERENCES movements(id),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE UNIQUE INDEX one_pending_request ON permission_requests(staff_id) WHERE status = 'pending';
CREATE INDEX idx_req_status ON permission_requests(status, created_at);
