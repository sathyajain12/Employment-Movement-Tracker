-- Migration number: 0001 	 2026-10-31T07:13:57.372Z
CREATE TABLE staff (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff','admin')),
  google_sub  TEXT UNIQUE,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE movements (
  id            INTEGER PRIMARY KEY,
  staff_id      INTEGER NOT NULL REFERENCES staff(id),
  time_out      TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  place         TEXT,
  permission_by INTEGER NOT NULL REFERENCES staff(id),
  time_in       TEXT,
  review        TEXT NOT NULL DEFAULT 'pending'
                CHECK (review IN ('pending','confirmed','flagged')),
  reviewed_at   TEXT,
  remarks       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT,
  CHECK (time_in IS NULL OR time_in > time_out)
);

CREATE UNIQUE INDEX one_open_per_staff ON movements(staff_id) WHERE time_in IS NULL;
CREATE INDEX idx_mov_time_out ON movements(time_out);
CREATE INDEX idx_mov_staff_time ON movements(staff_id, time_out);

CREATE TABLE movement_audit (
  id          INTEGER PRIMARY KEY,
  movement_id INTEGER NOT NULL REFERENCES movements(id),
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  reason      TEXT,
  changed_by  INTEGER NOT NULL REFERENCES staff(id),
  changed_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('time_limit_min', '60'),
  ('grace_min', '10'),
  ('office_close', '17:30');