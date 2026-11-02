-- Migration number: 0004 	 2026-11-02T06:00:00.000Z

-- What "Other" means, in the person's own words. Only set when category = 'Other'.
ALTER TABLE permission_requests ADD COLUMN category_other TEXT;
ALTER TABLE movements ADD COLUMN category_other TEXT;
