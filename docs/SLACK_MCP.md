# Slack MCP Measurement Notes

This document records the practical constraints we hit while measuring the Slack MCP server in this repository.

## Summary

- Public example config: [configs/slack.example.json](../configs/slack.example.json)
- Measured benchmark entry: [data/benchmarks.json](../data/benchmarks.json)
- Official docs:
  - https://docs.slack.dev/ai/slack-mcp-server/
  - https://docs.slack.dev/ai/slack-mcp-server/developing/

## What Is Different About Slack

Slack was not measurable here with the default remote-server path used for simpler HTTP MCP servers.

The main constraints were:

- The Slack MCP endpoint is Streamable HTTP, so the collector needed `mcp-remote` in `http-only` mode.
- Slack requires a pre-registered Slack app with confidential OAuth credentials.
- Slack required an HTTPS OAuth redirect URL for this app configuration.
- The generic `mcp-remote` flow needed local patching in this environment to complete the Slack OAuth flow and callback handling used for this measurement.

## App Requirements

The app needed more than a bare demo OAuth setup.

Working conditions included:

- `Model Context Protocol` enabled in the Slack app configuration
- A Slack app manifest/configuration that could complete install successfully
- Valid redirect URL registration for the OAuth callback
- Workspace approval for the requested scopes

## Measurement Notes

This benchmark run was measured on `2026-04-12`.

Recorded benchmark values:

- `toolCount`: `13`
- `staticTokens`: `8571`
- `toolDescriptionTokens`: `6181`
- `inputSchemaTokens`: `2305`
- `resourceTokens`: `28`

Heaviest tools:

- `slack_update_canvas`: `2719`
- `slack_create_canvas`: `1533`
- `slack_search_public_and_private`: `962`

## Repository Guidance

For publication, keep the durable artifacts and avoid committing local measurement scaffolding.

Safe to keep:

- `data/benchmarks.json`
- `configs/slack.example.json`
- this document

Do not publish:

- `configs/slack.local.json`
- `snapshots/slack.json`
- local patched `mcp-remote` artifacts used only to complete measurement in this environment
