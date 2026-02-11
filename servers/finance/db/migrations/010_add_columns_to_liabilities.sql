-- Add missing columns to liabilities table
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,2);
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Set defaults for existing liabilities
UPDATE liabilities SET remaining_amount = amount WHERE remaining_amount IS NULL;
UPDATE liabilities SET version = 1 WHERE version IS NULL;
