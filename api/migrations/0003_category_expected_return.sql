-- Migration number: 0003 	 2026-11-02T05:00:00.000Z

-- Quick-pick category (Bank, Medical, ...) kept apart from the free-text purpose, and the time
-- the person expects to be back. A request chosen as a duration ("30 min") also keeps the
-- minutes, so the return time can be counted from the moment it is approved.
ALTER TABLE permission_requests ADD COLUMN category TEXT;
ALTER TABLE permission_requests ADD COLUMN expected_return_at TEXT;
ALTER TABLE permission_requests ADD COLUMN expected_minutes INTEGER;

ALTER TABLE movements ADD COLUMN category TEXT;
ALTER TABLE movements ADD COLUMN expected_return_at TEXT;

CREATE INDEX idx_req_staff_created ON permission_requests(staff_id, created_at);
