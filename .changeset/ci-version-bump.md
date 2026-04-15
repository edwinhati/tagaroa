---
"admin": patch
"auth": patch
"finance": patch
"investment": patch
"web": patch
"core-service": patch
---

## CI/CD Improvements

- Add knip to build matrix in development, staging, and production workflows
- Fix knip to use `bunx knip --no-progress` and limit checks to dependencies/devDependencies/unlisted/files
- Fix detect-version-bumps.sh to properly detect version bumps in merge commits using HEAD^
- Change changeset version commit message from `chore: version packages` to `ci: version bump`
- Fix release branch to push directly to main instead of separate branch