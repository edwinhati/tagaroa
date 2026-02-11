-- Add version column to transactions table for optimistic concurrency control
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Set default version for existing transactions
UPDATE transactions SET version = 1 WHERE version IS NULL;
