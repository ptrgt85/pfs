-- Add theme preference column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'default';
