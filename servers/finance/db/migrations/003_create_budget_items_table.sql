CREATE TABLE IF NOT EXISTS budget_items (
    id UUID PRIMARY KEY,
    budget_id UUID NOT NULL,
    category VARCHAR(255) NOT NULL,
    allocation DECIMAL(15,2) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_budget_items_budget
         FOREIGN KEY (budget_id) REFERENCES budgets(id)
         ON DELETE CASCADE,
    CONSTRAINT chk_budget_items_allocation_non_negative CHECK (allocation >= 0)
);
