---
"admin": patch
"auth": patch
"finance": patch
"investment": patch
"web": patch
"core-service": patch
---

## CI/CD Simplification

- Remove selective deploy logic (detect-changes job) - deploy all apps on every push
- Use `--affected` flag instead of `--filter="...[origin/main]"` for build/test
- Use static deploy matrix with include instead of dynamic matrix from detect-changes
- Add knip to build matrix in all workflows
- Fix knip to use `bunx knip --no-progress` with limited scope
- Change changeset version commit message to `ci: version bump`
- Fix detect-version-bumps.sh to detect version bumps in merge commits