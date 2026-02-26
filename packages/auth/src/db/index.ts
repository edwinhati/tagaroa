import { relations } from "drizzle-orm";

import { accounts } from "./schemas/account.schema";
import { sessions } from "./schemas/session.schema";
import { users } from "./schemas/user.schema";

export { authSchema } from "./schema";
export { accounts } from "./schemas/account.schema";
export { sessions } from "./schemas/session.schema";
export { users } from "./schemas/user.schema";
export { verifications } from "./schemas/verification.schema";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  users: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  users: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));
