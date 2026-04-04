# AWS MCP Servers

`awslabs/mcp` は単一 server ではなく、用途別に分割された MCP server 群。

この repo では AWS 全体を単一 entry に潰さず、server 単位で別々に扱う。

AWS server の catalog は [aws-catalog.json](/Users/as/var/localrepos/mcp-static-context-viewer/configs/aws-catalog.json) にまとめている。

個別 server の local config を作るには:

```bash
bun run generate:aws-config --id aws-pricing
```

これで `configs/aws-pricing.local.json` が生成される。生成後に collector をその config へ向けて測定し、snapshot を dataset に upsert する。

## Current AWS Measurements

- measured AWS servers: `57`
- 測定範囲は local package, vendor source, official remote を含む

軽い側の例:

- `lambda-tool`: `29`
- `stepfunctions-tool`: `31`
- `core`: `129`
- `frontend`: `247`
- `amazon-neptune`: `275`

重い側の例:

- `aws-dataprocessing`: `34730`
- `aws-healthomics`: `31892`
- `elasticache`: `17685`
- `aws-iot-sitewise`: `15565`
- `cloudwatch-applicationsignals`: `15515`

この差が示す通り、AWS MCP 群は「AWS だから重い/軽い」ではなく、server の役割と schema 構造で大きく変わる。

補足:

- `aws-knowledge` は official remote `https://knowledge-mcp.global.api.aws` から測定
- `amazon-keyspaces` は upstream が Python `3.10`/`3.11` 前提なので、`uvx --python 3.11` で測定

## Catalog Notes

- `authMode = none`: 無認証で listing しやすい
- `authMode = aws_credentials`: AWS credentials が必要になりやすい
- `authMode = service_specific`: DB endpoint や service token など追加前提がある
- `authMode = none_or_local`: ローカル開発ワークフロー中心で listing 自体はしやすい可能性がある

## Current Blocks

- `openapi`
  固定 spec を与えれば起動に進むが、Petstore sample では upstream package が Python `3.13` / FastMCP API mismatch で起動途中に自壊した。さらに tool surface が与えた spec に依存するため、公開 benchmark に入れるなら fixture 固定方針が要る。
- `sagemaker-unified-studio-spark-troubleshooting`
  `mcp-proxy-for-aws` 経由で official remote には到達するが、この環境の `default` profile では `403 Forbidden`。事前の SageMaker Unified Studio setup と専用 role/profile が必要。
- `sagemaker-unified-studio-spark-upgrade`
  上と同じく official remote には到達するが `403 Forbidden`。事前セットアップ済みの role/profile が必要。

この時点では、deprecated な package は公開 benchmark から外している。
