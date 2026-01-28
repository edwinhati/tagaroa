CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    amount DECIMAL(15,2) DEFAULT 0,
    date DATE NOT NULL,
    notes TEXT,
    currency VARCHAR(3) NOT NULL,
    type VARCHAR(50) NOT NULL,
    files TEXT[],
    user_id UUID NOT NULL,
    account_id UUID NOT NULL,
    budget_item_id UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_transactions_account
        FOREIGN KEY (account_id) REFERENCES accounts(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_transactions_budget_item
        FOREIGN KEY (budget_item_id) REFERENCES budget_items(id)
        ON DELETE SET NULL
);
