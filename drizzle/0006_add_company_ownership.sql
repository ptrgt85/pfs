-- Add createdBy column to companies table for ownership tracking
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Create activity_log table for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for faster activity log queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
