# Contributing

Thanks for contributing to Waiver Director.

## Before You Start

- Keep each change focused on one product behavior or documentation concern.
- Preserve workspace isolation, server-side authorization, and signed-record integrity.
- Do not commit credentials, configuration values, customer data, provider account details, or generated files unless the task explicitly requires them.
- Do not change hosted-service configuration or deployments unless you have explicit authorization.

## Development And Validation

Install dependencies with `pnpm install`, then use the scripts in [README.md](README.md).
For substantive changes, run:

```sh
pnpm run check
pnpm run lint
```

State the validation you ran and any known gaps in the pull request description.

## Pull Requests

- Explain the product behavior changed and why.
- Keep the pull request limited to its stated scope.
- Link the tracking issue when one exists.
- Do not report or discuss suspected vulnerabilities in a public issue or pull request; follow [SECURITY.md](SECURITY.md) instead.
