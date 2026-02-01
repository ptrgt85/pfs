-- Add indexes for common query patterns to improve performance

-- Documents table: frequently queried by entityType and entityId
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);

-- User access: frequently joined with users and roles
CREATE INDEX IF NOT EXISTS idx_user_access_user ON user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_role ON user_access(role_id);
CREATE INDEX IF NOT EXISTS idx_user_access_entity ON user_access(entity_type, entity_id);

-- Sessions: queried by ID for auth checks
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Lots: frequently queried by stage
CREATE INDEX IF NOT EXISTS idx_lots_stage ON lots(stage_id);

-- Activity log: queried by user and time
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);

-- Invitations: queried by email and token
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
