# Start Pi with unavailable providers

Users can keep using Pi when a provider is disabled, unreachable, malformed, or slow.

## Sub-features

- `unavailable-disabled` skips disabled provider discovery.
- `unavailable-network` tolerates connection failure.
- `unavailable-invalid` rejects malformed external catalogs.
- `unavailable-deadline` bounds discovery headers and body with one five-second deadline.

## How to get to it (user POV)

Disable a provider in `/local-ai`, or start Pi while its configured server is stopped or faulty. Restart after changing the shared config.

## Driving it with Pi RPC and HTTP

Preconditions: isolated config and owned synthetic HTTP fixtures. Do not stop the user's model servers.

- **Disabled startup.** Run the baseline driver. Require idle Pi and `/local-ai` registration with all five providers initially disabled. This verifies usability but does not instrument absence of every request.
- **Unreachable startup.** In the isolated config enable only Ollama with `baseUrl: http://127.0.0.1:1`. Start a fresh owned Pi process. Require idle `get_state`, available commands, and no discovered Ollama model. Do not enable other providers to hide failure.
- **Faulty catalog.** Run an owned loopback server whose `/api/tags` response is `{"models":"invalid"}`. Enable only Ollama at its allocated port, restart Pi, and require startup remains usable with no Ollama registration. Preserve the exact response body and request log.
- **Supporting deadline checks.** Run `pnpm --filter @scaryrawr/pi-local-llm exec vitest run extensions/discovery.test.ts`. The suite covers stalled headers and a stalled JSON body under a shared deadline. Live stalled-server coverage needs its own owned HTTP fixture and measured readiness, not an assumed five-second sleep.

## Gotchas

- Missing or malformed config enables defaults; it does not disable providers. Never use that condition as a substitute for an explicit opt-out.
- Silent provider skipping is intentional. Read the returned model catalog to prove no malformed models registered.
- Startup health alone cannot prove deadlines or network inactivity.
- The baseline's saved Ollama opt-in is not followed by a discovery restart. Unreachable enabled coverage remains separate.
