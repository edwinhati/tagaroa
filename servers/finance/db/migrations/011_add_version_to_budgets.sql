-- Add version column to budgets table for optimistic concurrency control
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Set default version for existing budgets
UPDATE budgets SET version = 1 WHERE version IS NULL;
