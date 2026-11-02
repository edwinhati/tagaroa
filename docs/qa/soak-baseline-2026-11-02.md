## Core soak baseline, 2026-11-02

`servers/core/scripts/soak.ts` boots the core service on the isolated test
database (`test/start-e2e.ts`: migrate `tagaroa_test`, seed the e2e operator,
listen) in its own process, signs the operator in, enrols TOTP, and fires a
fixed rotation of requests at a fixed rate for a fixed time. It is not part of
`test` or CI.

```sh
cd servers/core
bun run test:soak -- --rate 50 --duration 600   # defaults: --rate 20 --duration 60 --port 8095
```

The rotation, ten requests repeated:

| Route group     | Requests                                                                   | Share |
| --------------- | -------------------------------------------------------------------------- | ----- |
| `directory`     | `GET /api/directory`, pages 1–3 of teams, positions and subsidiaries       | 20%   |
| `notifications` | `GET /api/notifications/messages` (pages 1–3, and `limit=100`), templates  | 30%   |
| `audit`         | `GET /api/directory/dashboard`, the audit timeline, pages 1–3              | 20%   |
| `session`       | `GET /api/auth/get-session`                                                | 10%   |
| `write`         | `PUT /api/directory/positions/group/:self`, an audited upsert of the title | 20%   |

The load is open loop: requests leave on schedule whether or not earlier ones
have answered, so a slow server shows up as latency, not as a lower rate. Any
non-2xx or a request over 10 s counts as an error and makes the script exit 1.
RSS is the server process alone, sampled with `ps` every 5 s; it is not taken
after a forced GC, so it moves with the allocator.

## Baseline

Apple M5 Pro, 24 GiB, Bun 1.4.4, PostgreSQL 18.4 in the repository's Docker
Compose, server and load generator on the same machine. One run, 600 s at
50 req/s.

| Route group   | Requests | p50 ms | p95 ms | p99 ms |
| ------------- | -------: | -----: | -----: | -----: |
| all           |   30,001 |    6.3 |   46.0 |   52.9 |
| directory     |    6,001 |    3.0 |    5.1 |    7.3 |
| notifications |    9,000 |    3.1 |   13.2 |   18.7 |
| audit         |    6,000 |   40.8 |   52.8 |   58.2 |
| session       |    3,000 |   10.1 |   28.3 |   30.4 |
| write         |    6,000 |    7.3 |   12.6 |   18.4 |

- Errors: 0. Achieved rate 50.0 req/s. The session was still valid at the end.
- Server RSS: 229.7 MiB at start, 209.7 MiB at the end, 307.6 MiB peak
  (−20.0 MiB over the run): no net growth in ten minutes.
- A 15 s run at 20 req/s on the same machine: 300 requests, 0 errors, p95
  44.0 ms, RSS +9.9 MiB.

## Reading it

- The dashboard (`audit`) is the slowest read by an order of magnitude and sets
  the overall p95. It assembles the whole read model before paging, and the
  audit table grew by 6,000 events during this run without the p99 moving
  past 60 ms.
- `get-session` p50 was 2.2 ms in the short run and 10.1 ms here. It shares the
  event loop with the dashboard at five times the rate; not investigated.

## Not covered

One operator, one session, one machine. No hours-long run, no staging, no
concurrency beyond what 50 req/s produces, no Better Auth rate limiting (off
outside production), no provider delivery. Compare a new run against this one
on the same machine and rate; across machines the numbers are not comparable.
