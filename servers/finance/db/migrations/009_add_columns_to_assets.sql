-- Add missing columns to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Set default version for existing assets
UPDATE assets SET version = 1 WHERE version IS NULL;
