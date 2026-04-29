# Agent Notes

- Use `bun` for package management and script execution in this repository.
- Do not use `npm / npx` for install, add, remove, or run tasks when a `bun` equivalent exists.
- Prefer:
  - `bun install`
  - `bun add <pkg>`
  - `bun remove <pkg>`
  - `bun run <script>`
  - `bunx <pkg>`

## Measurement & Release Workflow

### 1. Add a new MCP server measurement

Create a config file in `configs/`:

- `configs/<name>.example.json` — commitable template with placeholders
- `configs/<name>.local.json` — local-only with actual credentials (gitignored)

Config structure:

```json
{
  "id": "<id>",
  "name": "...",
  "vendor": "...",
  "category": "...",
  "repoUrl": "...",
  "version": "remote",
  "releasedAt": "YYYY-MM-DD",
  "status": "measured",
  "transport": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "<endpoint>"],
    "env": {}
  }
}
```

### 2. Collect measurement

```bash
bun run collect --config configs/<name>.local.json --out snapshots/<name>.json
```

Auth strategies (in order of preference):

- **No-auth / dummy token**: works for servers that list metadata without real credentials
- **API key in `.local.json`**: pass `--header` with actual token in args (spawn doesn't expand env vars)
- **OAuth (interactive)**: run collector with a long timeout (`--timeout 180000`), complete OAuth in browser. Token is cached by mcp-remote for subsequent runs.

### 3. Upsert to benchmark dataset

```bash
bun run upsert:benchmark --snapshot snapshots/<name>.json --data data/benchmarks.json --notes "Measured from ..."
```

Do not run multiple `upsert:benchmark` in parallel — it's a single-file rewrite.

### 4. Build & deploy

```bash
bun run build
```

Deployment is via **Cloudflare Workers Builds** (GitHub integration). Push to `main` to trigger auto-deploy:

```bash
git add configs/<name>.example.json data/benchmarks.json
git commit -m "Add <name> MCP benchmark entry"
git push origin main
```

The site auto-deploys from GitHub. Do NOT use `wrangler deploy` locally unless `CLOUDFLARE_API_TOKEN` is configured.

### 5. Validation

Always run before committing:

```bash
bun run format:check
bun run lint
bun run build
```

### Server auth classification

- **Class A** (no-auth/dummy): GitHub, PagerDuty, Notion, Brave Search, Grep, etc.
- **Class B** (real secret, non-interactive): Stripe (API key in config)
- **Class C** (manual OAuth): Honeycomb, Cloudflare GraphQL, Datadog, Linear, Sentry, PlanetScale
  - Measure locally, commit snapshot to dataset, push for deploy
