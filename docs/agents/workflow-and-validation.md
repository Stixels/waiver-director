# Change Scope And Validation

- Make focused edits that align with existing file and module patterns.
- Do not edit generated files unless explicitly requested.
- Do not introduce secrets, credentials, or environment values into source control.
- Do not add dependencies unless the task requires them.
- Do not run destructive git commands unless explicitly requested.

## Validation

- After substantive changes, run `pnpm run check` and `pnpm run lint`.
- For small or narrow changes, run the most relevant targeted validation and state what was and was not checked.

## Handoff

- Report changed files and any notable risks or follow-ups in the final summary.
