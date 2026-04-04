import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { encodingForModel } from "js-tiktoken";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type ServerConfig = {
  id: string;
  name: string;
  vendor: string;
  category: string;
  repoUrl: string;
  version: string;
  releasedAt: string;
  status?: "demo" | "measured";
  transport: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
  };
};

type ToolEntry = {
  name: string;
  description?: string;
  inputSchema?: Json;
};

type PromptEntry = {
  name: string;
  description?: string;
  arguments?: Json;
};

type ResourceEntry = {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
};

type Snapshot = {
  schemaVersion: "2026-04-04";
  methodologyVersion: string;
  tokenizerModel: string;
  collectedAt: string;
  server: {
    id: string;
    name: string;
    vendor: string;
    category: string;
    repoUrl: string;
    status: "demo" | "measured";
  };
  version: {
    version: string;
    releasedAt: string;
  };
  protocol: {
    requestedVersion: string;
    negotiatedVersion: string | null;
  };
  capabilities: Json;
  instructions: {
    text: string;
    tokens: number;
  };
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Json;
    tokens: {
      total: number;
      name: number;
      description: number;
      inputSchema: number;
    };
  }>;
  prompts: Array<{
    name: string;
    description: string;
    arguments: Json;
    tokens: {
      total: number;
      name: number;
      description: number;
      arguments: number;
    };
  }>;
  resources: Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    tokens: {
      total: number;
      uri: number;
      name: number;
      description: number;
      mimeType: number;
    };
  }>;
  totals: {
    staticTokens: number;
    instructionsTokens: number;
    toolNameTokens: number;
    toolDescriptionTokens: number;
    inputSchemaTokens: number;
    promptTokens: number;
    resourceTokens: number;
  };
  toolCount: number;
  heavyTools: Array<{
    name: string;
    tokens: number;
  }>;
};

const METHODOLOGY_VERSION = "2026-04-04";
const REQUESTED_PROTOCOL_VERSION = "2024-11-05";
const TOKENIZER_MODEL = "gpt-4o";

function usage() {
  console.error("Usage: bun run scripts/collect.ts --config <path> --out <path>");
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let configPath = "";
  let outPath = "";

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part === "--config") {
      configPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (part === "--out") {
      outPath = argv[i + 1] ?? "";
      i += 1;
    }
  }

  if (!configPath || !outPath) usage();
  return { configPath, outPath };
}

function stableStringify(value: Json): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function normalizeJson(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const out: Record<string, Json> = {};
    for (const key of Object.keys(object).sort()) {
      out[key] = normalizeJson(object[key]);
    }
    return out;
  }

  return String(value);
}

function makeTokenizer() {
  const enc = encodingForModel(TOKENIZER_MODEL);
  return (input: string) => enc.encode(input).length;
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function sortResources(items: ResourceEntry[]) {
  return [...items].sort((a, b) => a.uri.localeCompare(b.uri));
}

function isOptionalMethodError(error: unknown) {
  if (!(error instanceof Error)) return false;

  return [
    "Method not found",
    "method not found",
    "does not support",
    "not supported",
    "Unsupported",
    "-32601",
  ].some((marker) => error.message.includes(marker));
}

class StdioJsonRpcClient {
  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<
    number,
    { resolve: (value: Json) => void; reject: (error: Error) => void }
  >();
  private readonly child;

  constructor(private readonly config: ServerConfig["transport"]) {
    this.child = spawn(config.command, config.args ?? [], {
      cwd: config.cwd ? resolve(config.cwd) : process.cwd(),
      env: {
        ...process.env,
        ...config.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      process.stderr.write(chunk);
    });
    this.child.on("error", (error) => {
      for (const { reject } of this.pending.values()) {
        reject(error);
      }
      this.pending.clear();
    });
    this.child.on("exit", (code, signal) => {
      const message = `MCP process exited before request completed (code=${code}, signal=${signal})`;
      for (const { reject } of this.pending.values()) {
        reject(new Error(message));
      }
      this.pending.clear();
    });
  }

  private onData(chunk: string) {
    this.buffer += chunk;

    while (this.buffer.includes("\n")) {
      const newlineIndex = this.buffer.indexOf("\n");
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (!line) continue;

      const message = JSON.parse(line) as {
        id?: number;
        result?: Json;
        error?: { message?: string };
      };
      if (typeof message.id !== "number") continue;

      const pending = this.pending.get(message.id);
      if (!pending) continue;

      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message ?? "Unknown MCP error"));
        continue;
      }

      pending.resolve(message.result ?? null);
    }
  }

  request(method: string, params: Json = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    this.child.stdin.write(`${payload}\n`);

    return new Promise<Json>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method: string, params: Json = {}) {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    });

    this.child.stdin.write(`${payload}\n`);
  }

  async close() {
    this.child.stdin.end();
    this.child.kill();
  }
}

async function maybeRequest(client: StdioJsonRpcClient, method: string, fallback: Json) {
  try {
    return await client.request(method, {});
  } catch (error) {
    if (isOptionalMethodError(error)) return fallback;
    throw new Error(
      `Failed to collect ${method}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function collect(config: ServerConfig): Promise<Snapshot> {
  const client = new StdioJsonRpcClient(config.transport);
  const countTokens = makeTokenizer();

  try {
    const initializeResult = (await client.request("initialize", {
      protocolVersion: REQUESTED_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "mcp-context-pressure-index",
        version: "0.1.0",
      },
    })) as Record<string, Json>;

    client.notify("notifications/initialized", {});

    const toolsResult = (await maybeRequest(client, "tools/list", { tools: [] })) as Record<
      string,
      Json
    >;
    const promptsResult = (await maybeRequest(client, "prompts/list", { prompts: [] })) as Record<
      string,
      Json
    >;
    const resourcesResult = (await maybeRequest(client, "resources/list", {
      resources: [],
    })) as Record<string, Json>;

    const instructionsText =
      typeof initializeResult.instructions === "string" ? initializeResult.instructions : "";
    const toolEntries = sortByName(
      ((toolsResult.tools as ToolEntry[]) ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: normalizeJson(tool.inputSchema ?? {}),
      })),
    );
    const promptEntries = sortByName(
      ((promptsResult.prompts as PromptEntry[]) ?? []).map((prompt) => ({
        name: prompt.name,
        description: prompt.description ?? "",
        arguments: normalizeJson(prompt.arguments ?? []),
      })),
    );
    const resourceEntries = sortResources(
      ((resourcesResult.resources as ResourceEntry[]) ?? []).map((resource) => ({
        uri: resource.uri,
        name: resource.name ?? "",
        description: resource.description ?? "",
        mimeType: resource.mimeType ?? "",
      })),
    );

    const tools = toolEntries.map((tool) => {
      const nameTokens = countTokens(tool.name);
      const descriptionTokens = countTokens(tool.description);
      const inputSchemaString = stableStringify(tool.inputSchema);
      const inputSchemaTokens = countTokens(inputSchemaString);
      return {
        ...tool,
        tokens: {
          total: nameTokens + descriptionTokens + inputSchemaTokens,
          name: nameTokens,
          description: descriptionTokens,
          inputSchema: inputSchemaTokens,
        },
      };
    });

    const prompts = promptEntries.map((prompt) => {
      const nameTokens = countTokens(prompt.name);
      const descriptionTokens = countTokens(prompt.description);
      const argumentsTokens = countTokens(stableStringify(prompt.arguments));
      return {
        ...prompt,
        tokens: {
          total: nameTokens + descriptionTokens + argumentsTokens,
          name: nameTokens,
          description: descriptionTokens,
          arguments: argumentsTokens,
        },
      };
    });

    const resources = resourceEntries.map((resource) => {
      const uriTokens = countTokens(resource.uri);
      const nameTokens = countTokens(resource.name);
      const descriptionTokens = countTokens(resource.description);
      const mimeTypeTokens = countTokens(resource.mimeType);
      return {
        ...resource,
        tokens: {
          total: uriTokens + nameTokens + descriptionTokens + mimeTypeTokens,
          uri: uriTokens,
          name: nameTokens,
          description: descriptionTokens,
          mimeType: mimeTypeTokens,
        },
      };
    });

    const instructionsTokens = countTokens(instructionsText);
    const toolNameTokens = tools.reduce((sum, tool) => sum + tool.tokens.name, 0);
    const toolDescriptionTokens = tools.reduce((sum, tool) => sum + tool.tokens.description, 0);
    const inputSchemaTokens = tools.reduce((sum, tool) => sum + tool.tokens.inputSchema, 0);
    const promptTokens = prompts.reduce((sum, prompt) => sum + prompt.tokens.total, 0);
    const resourceTokens = resources.reduce((sum, resource) => sum + resource.tokens.total, 0);
    const staticTokens =
      instructionsTokens +
      toolNameTokens +
      toolDescriptionTokens +
      inputSchemaTokens +
      promptTokens +
      resourceTokens;

    if (
      staticTokens === 0 &&
      tools.length === 0 &&
      prompts.length === 0 &&
      resources.length === 0 &&
      instructionsText.length === 0
    ) {
      throw new Error(
        "Collector produced an empty snapshot. The target likely failed metadata enumeration.",
      );
    }

    return {
      schemaVersion: "2026-04-04",
      methodologyVersion: METHODOLOGY_VERSION,
      tokenizerModel: TOKENIZER_MODEL,
      collectedAt: new Date().toISOString(),
      server: {
        id: config.id,
        name: config.name,
        vendor: config.vendor,
        category: config.category,
        repoUrl: config.repoUrl,
        status: config.status ?? "measured",
      },
      version: {
        version: config.version,
        releasedAt: config.releasedAt,
      },
      protocol: {
        requestedVersion: REQUESTED_PROTOCOL_VERSION,
        negotiatedVersion:
          typeof initializeResult.protocolVersion === "string"
            ? initializeResult.protocolVersion
            : null,
      },
      capabilities: normalizeJson(initializeResult.capabilities ?? {}),
      instructions: {
        text: instructionsText,
        tokens: instructionsTokens,
      },
      tools,
      prompts,
      resources,
      totals: {
        staticTokens,
        instructionsTokens,
        toolNameTokens,
        toolDescriptionTokens,
        inputSchemaTokens,
        promptTokens,
        resourceTokens,
      },
      toolCount: tools.length,
      heavyTools: [...tools]
        .sort((a, b) => b.tokens.total - a.tokens.total)
        .slice(0, 3)
        .map((tool) => ({
          name: tool.name,
          tokens: tool.tokens.total,
        })),
    };
  } finally {
    await client.close();
  }
}

async function main() {
  const { configPath, outPath } = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await readFile(resolve(configPath), "utf8")) as ServerConfig;
  const snapshot = await collect(config);
  const outputPath = resolve(outPath);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(`${outputPath}`, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      server: snapshot.server.id,
      version: snapshot.version.version,
      staticTokens: snapshot.totals.staticTokens,
      toolCount: snapshot.toolCount,
      out: outputPath,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
