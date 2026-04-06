# AWS MCP Servers

`awslabs/mcp` is not a single MCP server. It is a family of specialized servers.

This repo does not collapse AWS into one entry. AWS servers are measured and presented as separate benchmark entries.

The AWS server catalog is maintained in [configs/aws-catalog.json](../configs/aws-catalog.json).

To generate a local config for an individual AWS server:

```bash
bun run generate:aws-config --id aws-pricing
```

This creates `configs/aws-pricing.local.json`. After that, point the collector at the generated config, produce a snapshot, and upsert the snapshot into the benchmark dataset.

## Current AWS Measurements

- measured AWS servers: `57`
- coverage includes local packages, vendor source, and official remote endpoints

Examples on the lighter end:

- `lambda-tool`: `29`
- `stepfunctions-tool`: `31`
- `core`: `129`
- `frontend`: `247`
- `amazon-neptune`: `275`

Examples on the heavier end:

- `aws-dataprocessing`: `34730`
- `aws-healthomics`: `31892`
- `elasticache`: `17685`
- `aws-iot-sitewise`: `15565`
- `cloudwatch-applicationsignals`: `15515`

The spread is the point: AWS MCP servers do not share one uniform footprint. Static cost varies sharply by server role and schema shape.

Notes:

- `aws-knowledge` was measured from the official remote endpoint `https://knowledge-mcp.global.api.aws`
- `amazon-keyspaces` currently assumes Python `3.10` or `3.11` upstream, so it was measured with `uvx --python 3.11`

## Catalog Notes

- `authMode = none`: metadata listing is usually easy without authentication
- `authMode = aws_credentials`: AWS credentials are often required
- `authMode = service_specific`: extra inputs such as DB endpoints or service tokens are required
- `authMode = none_or_local`: the server is mainly aimed at local workflows and listing may still be easy

## Current Blocks

- `openapi`
  It can start when given a fixed spec, but with the Petstore sample the upstream package failed during startup because of a Python `3.13` / FastMCP API mismatch. Its tool surface also depends on the input spec, so including it in the public benchmark would require a fixed fixture policy.
- `sagemaker-unified-studio-spark-troubleshooting`
  The official remote endpoint is reachable through `mcp-proxy-for-aws`, but this environment's `default` profile receives `403 Forbidden`. It requires prior SageMaker Unified Studio setup and a dedicated role/profile.
- `sagemaker-unified-studio-spark-upgrade`
  Same as above: the official remote endpoint is reachable, but the current environment receives `403 Forbidden`. It requires prior setup and a dedicated role/profile.

Deprecated packages are excluded from the public benchmark.
