# pi-copilot

Use your account's GitHub Copilot models in `pi`.

The extension fetches the models available to your account and maps them to Pi's model format. It uses Pi's built-in `github-copilot` provider for [OAuth](https://github.com/earendil-works/pi/blob/main/packages/ai/src/utils/oauth/github-copilot.ts), credential storage, and token refresh. A local model cache lets it load models without waiting for a network request.

## Install

Install the extension:

```bash
pi install git:github.com/scaryrawr/pi-copilot
```

## Development

Install dependencies with `pnpm install --frozen-lockfile` from the monorepo root.
Run the following from this package directory, or use `pnpm --filter pi-copilot <script>` from the root:

| Task        | Command         |
| ----------- | --------------- |
| Type-check  | `pnpm build`    |
| Format      | `pnpm fmt`      |
| Lint        | `pnpm lint`     |
| Test        | `pnpm test:run` |
| Watch tests | `pnpm test`     |

## Architecture

The modules in `extensions/copilot/` divide the work:

- `api.ts`: Fetches and parses the Copilot models payload.
- `cache.ts`: Manages the on-disk cache of the model list.
- `credentials.ts`: Reads stored authentication credentials.
- `inference.ts`: Infers model capabilities from the API response.
- `mapping.ts`: Maps Copilot API entries to Pi models and preserves curated fields.
- `state.ts`: Updates the provider's models.

## Contributing

Read [AGENTS.md](AGENTS.md) before changing the provider.
