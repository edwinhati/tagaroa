import * as z from "zod";

// The edge CSP has no 'unsafe-eval'. Zod probes `new Function` when a schema is
// defined, so this must run first or every page logs a CSP violation.
z.config({ jitless: true });
