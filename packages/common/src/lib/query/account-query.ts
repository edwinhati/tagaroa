"use client";

import type {
	Account,
	AccountResponse,
	AccountsApiResponse,
	PaginatedAccountsResult,
} from "@repo/common/types/account";
import { financeApi } from "@repo/common/lib/http";

const mapAccount = (account: AccountResponse): Account => ({
	id:
		account.id !== undefined && account.id !== null && account.id.trim() !== ""
			? String(account.id)
			: undefined,
	name: account.name,
	notes: account.notes,
	type: account.type,
	balance: account.balance,
	currency: account.currency,
	deletedAt: account.deleted_at ?? null,
});

// Fetch all accounts with pagination
export const fetchAccounts = async (params?: {
	page?: number;
	limit?: number;
	filters?: Record<string, string[]>;
	search?: string;
}): Promise<PaginatedAccountsResult> => {
	const searchParams = new URLSearchParams();

	if (params?.page) searchParams.append("page", params.page.toString());
	if (params?.limit) searchParams.append("limit", params.limit.toString());
	if (params?.search) searchParams.append("search", params.search);

	// Add dynamic filters - support comma-separated values for multi-select
	if (params?.filters) {
		for (const [key, values] of Object.entries(params.filters)) {
			if (values.length > 0) {
				// Join multiple values with comma for multi-select support
				searchParams.append(key, values.join(","));
			}
		}
	}

	const queryString = searchParams.toString();
	const url = queryString ? `/accounts?${queryString}` : "/accounts";

	try {
		const data = await financeApi.get<AccountsApiResponse>(url, {
			unwrapData: false,
		});

		return {
			accounts: data.data ? data.data.map(mapAccount) : [],
			pagination: data.pagination,
			aggregations: data.aggregations || {},
		};
	} catch (error) {
		console.error("Error fetching accounts:", error);
		throw error;
	}
};

// Fetch account types
export const fetchAccountTypes = async (): Promise<string[]> => {
	return financeApi.get<string[]>("/account/types");
};

// Create or update an account
export const mutateAccount = async (account: Account): Promise<Account> => {
	// Map frontend Account (camelCase) to backend payload (snake_case)
	const payload = {
		id: account.id,
		name: account.name,
		type: account.type,
		balance: account.balance,
		currency: account.currency,
		notes: account.notes ?? "",
		deleted_at: account.deletedAt ?? null,
	};

	// Check if account.id exists and is not empty string
	const hasValidId = account.id && account.id.trim() !== "";

	const data = await (hasValidId
		? financeApi.put<AccountResponse>(`/account/${account.id}`, payload)
		: financeApi.post<AccountResponse>("/account", payload));

	return mapAccount(data);
};

// Delete an account
export const deleteAccount = async (id: string): Promise<void> => {
	await financeApi.delete(`/account/${id}`);
};
