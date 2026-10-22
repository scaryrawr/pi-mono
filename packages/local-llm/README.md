# pi-local-llm

Use local models in the [pi coding agent](https://github.com/earendil-works/pi) with Ollama, LM Studio, OMLX, Osaurus, or GenieX. The plugin discovers models from enabled providers when pi starts.

## Install

1. Install pi if you do not already have it. Pi requires Node.js 22.19 or newer.

   ```bash
   npm install -g --ignore-scripts @earendil-works/pi-coding-agent
   ```

2. Install the plugin from GitHub:

   ```bash
   pi install git:github.com/scaryrawr/pi-local-llm
   ```

   To install only for the current project, add `--local`:

   ```bash
   pi install git:github.com/scaryrawr/pi-local-llm --local
   ```

3. Start your local model server and download or load a model in that provider.

4. Start a new interactive pi session:

   ```bash
   pi
   ```

5. Run `/local-ai` to choose providers. Use the up and down arrow keys to navigate, Space to toggle, Enter to save, or Escape to cancel.

6. Restart pi to apply the changes. Select a discovered model in pi's model picker.

All providers are disabled until you enable them. The plugin does not install model servers or download models.

## Configure a server

The `/local-ai` command saves provider selections to `~/.pi/agent/pi-local-llm.json`. To change a server address or API key, edit that file. If you set `PI_CODING_AGENT_DIR`, the file lives in that directory instead.

For example, this configuration enables Ollama with its default server address:

```json
{
  "providers": {
    "ollama": {
      "enabled": true,
      "baseUrl": "http://localhost:11434",
      "apiKey": "ollama",
      "contextLength": 131072
    }
  }
}
```

Omit `baseUrl` and `apiKey` to use provider defaults. Set `apiKey` to your server's token if authentication is required. Use the server's root URL for `baseUrl`, without a trailing slash or `/v1`.

See [`pi-local-llm.example.json`](pi-local-llm.example.json) for all provider keys and default addresses. That example enables only Ollama.

Provider settings always come from this shared file, even when the plugin is installed with `--local`. There are no provider-specific environment variables.

Restart pi after changing the configuration or the server's available models.

## Troubleshoot missing models

If no models appear:

- Run `/local-ai` and check that the provider is enabled, then restart pi.
- Check that the model server is running and has a model available.
- Check that `baseUrl` matches the server address and `apiKey` matches any required token.
- Check that `pi-local-llm.json` contains valid JSON and that `enabled` is the boolean `true`, not the string `"true"`.

Missing or malformed configuration disables registration. Unavailable providers are skipped silently so pi can still start.

## Remove

```bash
pi remove git:github.com/scaryrawr/pi-local-llm
```

If you installed with `--local`, add `--local` to the remove command too.
