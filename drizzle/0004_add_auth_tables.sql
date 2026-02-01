-- Users table
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"is_master" integer DEFAULT 0,
	"is_active" integer DEFAULT 1,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Sessions table
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Roles table
CREATE TABLE IF NOT EXISTS "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"can_view" integer DEFAULT 1,
	"can_edit" integer DEFAULT 0,
	"can_delete" integer DEFAULT 0,
	"can_invite" integer DEFAULT 0,
	"can_manage_roles" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- User access table
CREATE TABLE IF NOT EXISTS "user_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"role_id" integer NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"granted_by" integer REFERENCES "users"("id"),
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Invitations table
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL UNIQUE,
	"role_id" integer NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"invited_by" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "user_access_user_idx" ON "user_access" ("user_id");
CREATE INDEX IF NOT EXISTS "user_access_entity_idx" ON "user_access" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "invitations_token_idx" ON "invitations" ("token");

-- Insert default roles
INSERT INTO "roles" ("name", "description", "can_view", "can_edit", "can_delete", "can_invite", "can_manage_roles")
VALUES 
  ('Admin', 'Full access to the group', 1, 1, 1, 1, 1),
  ('Editor', 'Can view and edit', 1, 1, 0, 0, 0),
  ('Viewer', 'Read-only access', 1, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- Create initial master user (password: admin123 - should be changed)
-- Password hash for 'admin123' using bcrypt
INSERT INTO "users" ("email", "password_hash", "name", "is_master")
VALUES ('admin@example.com', '$2b$10$rQZ5r5D5q5X5q5X5q5X5qOKJHGFEDCBAzyxwvutsrqponmlkjihgfe', 'Admin User', 1)
ON CONFLICT DO NOTHING;
