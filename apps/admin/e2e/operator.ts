/**
 * The operator this worker signs in as. Tests change an operator's MFA, role
 * and sessions, so workers each get one of the accounts seeded by
 * `servers/core/test/e2e-admin.ts` instead of sharing a single account.
 */
export const operator = {
  email: `e2e-admin-${process.env.TEST_PARALLEL_INDEX ?? 0}@tagaroa.test`,
  password: "e2e-admin-password-12",
};
