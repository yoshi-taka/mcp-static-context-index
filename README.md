https://mcpindex.veritycost.com/

# MCP Static Context Index

Public benchmark for comparing the `static exposure` of MCP servers.

This project measures `static definition cost` under consistent conditions across MCP servers. It does not claim to represent the exact number of tokens injected into a model at runtime. The benchmark focuses on `instructions`, `tools`, `tool descriptions`, `tool input schemas`, `prompts`, and `resources metadata`.

The benchmark treats `default exposed surface` as the baseline whenever a server has a meaningful default mode. This is intentional: most MCP clients and agent runtimes do not automatically narrow a server's tool surface for you, so the default `tools/list` result is often the most realistic comparison point. When a server also supports explicit narrowing, that narrowed profile may be included as an additional comparison case rather than replacing the default baseline.

For AWS-specific server handling, see [docs/AWS_SERVERS.md](./docs/AWS_SERVERS.md). A Japanese overview is available in [README.ja.md](./README.ja.md).

## Local Development

```bash
bun install
bun run dev
```

Open `http://localhost:3001`.

Validation:

```bash
bun run format:check
bun run lint
bun run build
```

## Collector

Run the collector against the mock server:

```bash
bun run collect:mock
```

Measure an MCP server with a config file:

```bash
bun run collect --config configs/pagerduty.example.json --out snapshots/pagerduty.json
```

Official remote example configs are available for selected servers such as [configs/datadog.example.json](./configs/datadog.example.json). Datadog uses the official `datadog_mcp_cli` transport rather than generic `mcp-remote`, and the Datadog site should be selected explicitly with `--site`.
Grafana is available as [configs/grafana.example.json](./configs/grafana.example.json). The official `grafana/mcp-grafana` server can be run with `uvx mcp-grafana` and requires `GRAFANA_URL` plus a service account token.
Slack is available as [configs/slack.example.json](./configs/slack.example.json). Measurement-specific notes live in [docs/SLACK_MCP.md](./docs/SLACK_MCP.md).
The current dataset also includes official remote targets that are measurable without account authentication, such as Grep, alongside local measurement targets such as Stripe via API key and the Google Workspace Gemini CLI extension via pre-login static listing, plus manual OAuth targets such as Linear, PlanetScale, and Sentry.

Upsert a snapshot into the benchmark dataset:

```bash
bun run upsert:benchmark --snapshot snapshots/pagerduty.json --data data/benchmarks.json --notes "Measured from PagerDuty release X"
```

Do not run multiple `upsert:benchmark` writes against `data/benchmarks.json` in parallel. The dataset update is a single-file rewrite and should be treated as a sequential step.

The collector calls `initialize`, `tools/list`, `prompts/list`, and `resources/list`, normalizes the response into canonical JSON, and counts tokens from that static metadata.

## Repository Boundaries

- `vendor/` is for local clones and build artifacts and is not part of the public repo
- `configs/*.local.json` contains secrets or machine-local settings and must not be committed
- `snapshots/*.json` are local measurement outputs and are treated as intermediate artifacts
- The public source of truth is the site implementation, the collector scripts, and `data/benchmarks.json`

## Cloudflare Workers

This site is intended to be published as static assets on Cloudflare Workers.

- Build command: `bun run build`
- Output directory: `dist/`
- Runtime config: [wrangler.toml](./wrangler.toml)

Two deployment modes are possible:

- Cloudflare GitHub integration / Workers Builds: no GitHub repository secret is needed in this repo
- Local `wrangler deploy`: requires local Cloudflare authentication such as `wrangler login` or an API token

The current repo is aligned to the first mode: publish from Cloudflare's GitHub integration, not from GitHub Actions in this repository.

## OSS Publish Checklist

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `docs/internal/`, `vendor/`, `configs/*.local.json`, and `snapshots/*.json` are excluded from publication
- `LICENSE` is present
- Cloudflare GitHub integration is configured against the repository and build output

## Measurement Automation

Benchmark measurement can be automated later, but publication is the current priority.

- Non-interactive listing targets can be measured in CI
- Manual OAuth targets remain local/manual
- Real-credential targets should only be added after explicit inclusion rules are documented

## Terms

- `Tool`: one operation exposed by an MCP server
- `Tool Avg`: average static token cost per tool
- `Schema Share`: share of total static tokens caused by input schemas

## License

MIT
