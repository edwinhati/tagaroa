CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    amount DECIMAL(15,2) DEFAULT 0,
    user_id UUID NOT NULL,
    currency VARCHAR(3) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT budgets_user_month_year_unique UNIQUE (user_id, year, month),
    CONSTRAINT chk_budgets_month CHECK (month BETWEEN 1 AND 12),
    CONSTRAINT chk_budgets_year CHECK (year BETWEEN 2000 AND 2100),
    CONSTRAINT chk_budgets_amount_non_negative CHECK (amount >= 0)
);
