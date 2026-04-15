https://mcpindex.veritycost.com/

# MCP Static Context Index

MCP server の `static exposure` を比較する公開ベンチマークです。

この project は `runtime usage` ではなく、`instructions`、`tools`、`tool descriptions`、`tool input schemas`、`prompts`、`resources metadata` の `static definition cost` を同一条件で測ります。

比較の baseline は、server に意味のある default mode がある場合は `default exposed surface` を優先します。これは多くの MCP client や agent runtime が server の tool surface を自動で都合よく絞ってくれるわけではなく、実際には default の `tools/list` がそのまま見えることが多いためです。server 側に明示的な絞り込み機構がある場合は、default baseline を置いたうえで narrowed profile を追加比較として扱います。

AWS 系 server の扱いは [docs/AWS_SERVERS.md](./docs/AWS_SERVERS.md) を参照してください。英語の正本は [README.md](./README.md) です。

## Local

```bash
bun install
bun run dev
```

`http://localhost:3001` を開く。

検証:

```bash
bun run format:check
bun run lint
bun run build
```

## Collector

mock server で collector を試す:

```bash
bun run collect:mock
```

任意の MCP server を測る:

```bash
bun run collect --config configs/pagerduty.example.json --out snapshots/pagerduty.json
```

Slack 用の雛形は [configs/slack.example.json](./configs/slack.example.json) に追加しています。計測時の注意は [docs/SLACK_MCP.md](./docs/SLACK_MCP.md) を参照してください。

snapshot を dataset に反映する:

```bash
bun run upsert:benchmark --snapshot snapshots/pagerduty.json --data data/benchmarks.json --notes "Measured from PagerDuty release X"
```

collector は `initialize`, `tools/list`, `prompts/list`, `resources/list` を取得し、canonical JSON に正規化したうえで token 数を計測します。

## Repository Boundaries

- `vendor/` はローカル clone や build artifact 用
- `configs/*.local.json` は秘密情報やローカル設定を含むため commit しない
- `snapshots/*.json` は中間生成物として扱う
- 公開 repo の source of truth は site 実装、collector scripts、`data/benchmarks.json`

## Cloudflare Workers

この site は Cloudflare Workers の static assets 配信で公開する想定です。

- Build command: `bun run build`
- Output directory: `dist/`
- Runtime config: [wrangler.toml](./wrangler.toml)

deploy 方式は 2 つあります。

- Cloudflare の GitHub integration / Workers Builds を使う場合: この repo に Cloudflare 用 GitHub secret は不要
- ローカルで `wrangler deploy` を使う場合: `wrangler login` か API token などの Cloudflare 認証が必要

現状の repo は前者、つまり Cloudflare 側の GitHub integration で publish する前提に寄せています。

## OSS Publish Checklist

- `bun run format:check`
- `bun run lint`
- `bun run build`
- `docs/internal/`, `vendor/`, `configs/*.local.json`, `snapshots/*.json` が公開対象から外れている
- `LICENSE` がある
- Cloudflare GitHub integration が repository と build output に対して設定されている

## License

MIT
