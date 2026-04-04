# Automation Design

## Goals

- Cloudflare Workers への deploy 方針を公開前に固定しすぎない
- benchmark 測定は server ごとの認証 reality を隠さず扱う
- `snapshots/*.json` を公開 repo の source of truth にせず、artifact と dataset 更新を分離する

## Target Classes

### Class A: no-auth / dummy-auth allowed

例:

- GitHub
- PagerDuty
- Notion
- Brave Search
- Azure DevOps
- LaunchDarkly
- AWS Documentation

この class は `workflow_dispatch` で即時測定しやすく、安定した運用が見えたものだけ `schedule` に昇格させる。

### Class B: real secret required, but non-interactive

例:

- Stripe
- 一部の vendor server

この class は repository secrets を要求する。schedule を入れる場合でも、対象 server を明示し、secret の権限範囲を限定する。

### Class C: manual OAuth required

例:

- Cloudflare GraphQL
- Linear official remote
- Datadog official remote via `datadog_mcp_cli`

GitHub Actions に載せない。local で測定して snapshot artifact を人手レビューし、dataset 反映は PR ベースにする。

## Recommended Flow

1. `measure-benchmark.yml` を `workflow_dispatch` で実行する
2. workflow は CI-safe な template config から一時 config を生成する
3. collector で snapshot を作成し、artifact として保存する
4. `publish_dataset=true` のときだけ `data/benchmarks.json` を更新し、PR を作る
5. site deploy は当面 manual に保ち、Cloudflare credential 運用が固まってから CI 化する

## Why Snapshot Artifacts Stay Out Of Git

- snapshot は中間生成物でサイズも増えやすい
- credential / auth mode の違いを commit 履歴に混ぜたくない
- 公開 repo の比較対象は最終 dataset で十分

## CI-safe Config Templates

`configs/ci/*.json` は commit 可能な template として扱う。secret や runner 依存値は `${ENV_NAME}` または `${ENV_NAME:-fallback}` で遅延解決する。

たとえば GitHub MCP の測定では次の値を workflow 側から注入する。

- `MCP_SERVER_VERSION`
- `MCP_RELEASED_AT`
- `GITHUB_MCP_IMAGE_TAG`
- `GITHUB_PERSONAL_ACCESS_TOKEN`

現状の GitHub benchmark workflow は `GITHUB_PERSONAL_ACCESS_TOKEN=ci-dummy-token` を固定で使う。

## Scheduling Guidance

いきなり全 target を cron 化しないほうがよい。最初は次の順で進める。

1. GitHub 系の 3 variant を `workflow_dispatch` で安定化
2. 成功率と upstream の tag 運用が安定してから週次 `schedule` を追加
3. vendor ごとの auth rule を `docs/AUTOMATION.md` に追記して対象を増やす

## Current Repository Choices

- Cloudflare deploy workflow はまだ置かない
- benchmark workflow は snapshot artifact を残し、dataset 更新は PR ベースにする
- GitHub benchmark workflow は secret ではなく dummy token を使う
- Cloudflare GraphQL のような manual OAuth target は automation 対象外とする
