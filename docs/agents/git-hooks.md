# Git hooks

Install [hk](https://hk.jdx.dev) 2.8.0 or newer with `brew install hk`, then run
`bun install`. The root `prepare` script runs `hk install` for this repository.
hk uses native Git hook configuration on Git 2.54+, or `.git/hooks` on older Git.
No tracked hooks folder is needed.

The pre-commit hook runs the steps in `hk.pkl` in parallel: Oxfmt and Oxlint on
staged files, plus the existing full typecheck and unit test scripts. It also
rejects staged Impeccable Live injections through `scripts/check-live-staged.sh`.
Checks report failures without fixing or staging files. hk temporarily stashes
unstaged work so checks see the staged snapshot and restores it afterward.

Preview with `hk run pre-commit --plan`. Run `hk check --all` for the quality
checks against the working tree without stashing. Integration and browser tests
remain separate commands because they require running services.

This uses the existing Oxfmt/Oxlint configuration and Bun dependencies; Husky,
lint-staged and Prettier are not needed.
