import { SetMetadata } from "@nestjs/common";

export const SESSION_ONLY = Symbol("SESSION_ONLY");

// The handler must derive the person from the session and enforce resource ownership.
export const SessionOnly = () => SetMetadata(SESSION_ONLY, true);
