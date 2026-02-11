-- Add spent column to budget_items table
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS spent DECIMAL(15,2) DEFAULT 0;

-- Set default spent for existing budget items
UPDATE budget_items SET spent = 0 WHERE spent IS NULL;
