import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type BenchmarkData = {
  methodologyVersion: string;
  description: string;
  servers: BenchmarkServer[];
};

type BenchmarkServer = {
  id: string;
  name: string;
  vendor: string;
  category: string;
  repoUrl: string;
  status: string;
  history: BenchmarkVersion[];
};

type BenchmarkVersion = {
  version: string;
  releasedAt: string;
  toolCount: number;
  totals: {
    staticTokens: number;
    instructionsTokens: number;
    toolNameTokens: number;
    toolDescriptionTokens: number;
    inputSchemaTokens: number;
    promptTokens: number;
    resourceTokens?: number;
  };
  heavyTools: Array<{
    name: string;
    tokens: number;
  }>;
  notes: string;
};

type Snapshot = {
  methodologyVersion: string;
  server: {
    id: string;
    name: string;
    vendor: string;
    category: string;
    repoUrl: string;
    status: string;
  };
  version: {
    version: string;
    releasedAt: string;
  };
  toolCount: number;
  totals: BenchmarkVersion["totals"];
  heavyTools: BenchmarkVersion["heavyTools"];
};

function usage() {
  console.error(
    "Usage: bun run scripts/upsert-benchmark.ts --snapshot <path> --data <path> [--notes <text>]",
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let snapshotPath = "";
  let dataPath = "";
  let notes = "";

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part === "--snapshot") {
      snapshotPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (part === "--data") {
      dataPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (part === "--notes") {
      notes = argv[i + 1] ?? "";
      i += 1;
    }
  }

  if (!snapshotPath || !dataPath) usage();
  return { snapshotPath, dataPath, notes };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T;
}

function sortHistory(history: BenchmarkVersion[]) {
  return [...history].sort(
    (a, b) => new Date(a.releasedAt).getTime() - new Date(b.releasedAt).getTime(),
  );
}

async function main() {
  const { snapshotPath, dataPath, notes } = parseArgs(process.argv.slice(2));
  const snapshot = await readJson<Snapshot>(snapshotPath);
  const data = await readJson<BenchmarkData>(dataPath);

  const version: BenchmarkVersion = {
    version: snapshot.version.version,
    releasedAt: snapshot.version.releasedAt,
    toolCount: snapshot.toolCount,
    totals: snapshot.totals,
    heavyTools: snapshot.heavyTools,
    notes: notes || "Measured from canonical MCP snapshot.",
  };

  const existing = data.servers.find((server) => server.id === snapshot.server.id);

  if (existing) {
    existing.name = snapshot.server.name;
    existing.vendor = snapshot.server.vendor;
    existing.category = snapshot.server.category;
    existing.repoUrl = snapshot.server.repoUrl;
    existing.status = snapshot.server.status;
    existing.history = sortHistory([
      ...existing.history.filter((entry) => entry.version !== version.version),
      version,
    ]);
  } else {
    data.servers.push({
      id: snapshot.server.id,
      name: snapshot.server.name,
      vendor: snapshot.server.vendor,
      category: snapshot.server.category,
      repoUrl: snapshot.server.repoUrl,
      status: snapshot.server.status,
      history: [version],
    });
  }

  data.methodologyVersion = snapshot.methodologyVersion;
  data.servers.sort((a, b) => a.name.localeCompare(b.name));

  const outPath = resolve(dataPath);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      updated: snapshot.server.id,
      version: version.version,
      data: outPath,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
