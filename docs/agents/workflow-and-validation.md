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

## Linear To GitHub Delivery

- Treat Linear as the source of truth for feature scope and delivery status. Read the issue, parent issue, relations, and comments before changing code.
- When actively taking a ticket, assign it to the current developer and move it to `In Progress`. Do not change status for read-only investigation.
- Branch from the latest `origin/main` and include the Linear identifier in the branch name. Codex branches use `codex/<issue-id>-<short-slug>`; other contributors may use Linear's generated branch name.
- Keep the ticket identifier in commits and the pull request title or body so Linear and GitHub can associate the work.
- GitHub calls merge requests “pull requests” (PRs). Open a focused PR with the Linear link, implementation summary, validation performed, and any deployment, schema, credential, or follow-up requirements.
- Move the Linear issue to `In Review` only after the PR exists, and add the PR link to Linear when it is not linked automatically. Move it to `Done` after merge, not merely after local validation.
- Preserve unrelated working-tree changes and never include local credentials or workspace-specific environment values in a branch or PR.
