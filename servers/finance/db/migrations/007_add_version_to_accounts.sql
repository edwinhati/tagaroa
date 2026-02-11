-- Add version column to accounts table for optimistic concurrency control
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Set default version for existing accounts
UPDATE accounts SET version = 1 WHERE version IS NULL;
