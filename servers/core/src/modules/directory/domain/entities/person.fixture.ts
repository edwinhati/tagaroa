import { Person, type PersonProps } from "./person.entity";

/** A plain, unremarkable person. Overridden per test with the one odd fact. */
export const NOW = new Date("2026-03-12T09:30:00.000Z"); // a Thursday

export const daysBefore = (days: number): Date =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

export const person = (overrides: Partial<PersonProps> = {}): Person =>
  Person.restore({
    banned: false,
    createdAt: NOW,
    email: "ada@example.com",
    emailVerified: true,
    id: "u1",
    mustChangePassword: false,
    name: "Ada",
    role: null,
    updatedAt: NOW,
    ...overrides,
  });
