import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function usage() {
  console.error(
    "Usage: bun run scripts/render-ci-config.ts --template <path> --out <path> [--version <text>] [--released-at <date>]",
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let templatePath = "";
  let outPath = "";
  let version = "";
  let releasedAt = "";

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];

    if (part === "--template") {
      templatePath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (part === "--out") {
      outPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (part === "--version") {
      version = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (part === "--released-at") {
      releasedAt = argv[i + 1] ?? "";
      i += 1;
    }
  }

  if (!templatePath || !outPath) usage();
  return { templatePath, outPath, version, releasedAt };
}

function resolveTemplateString(value: string): string {
  return value.replace(
    /\$\{([A-Z0-9_]+)(:-([^}]*))?\}/g,
    (_, name: string, __: string, fallback: string) => {
      const envValue = process.env[name];
      if (envValue !== undefined && envValue !== "") return envValue;
      if (fallback !== undefined) return fallback;
      throw new Error(`Missing required environment variable: ${name}`);
    },
  );
}

function resolveTemplates(value: Json): Json {
  if (typeof value === "string") {
    return resolveTemplateString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplates(item));
  }

  if (value && typeof value === "object") {
    const next: Record<string, Json> = {};

    for (const [key, entry] of Object.entries(value)) {
      next[key] = resolveTemplates(entry);
    }

    return next;
  }

  return value;
}

async function main() {
  const { templatePath, outPath, version, releasedAt } = parseArgs(process.argv.slice(2));
  const template = JSON.parse(await readFile(resolve(templatePath), "utf8")) as Json;
  const rendered = resolveTemplates(template) as Record<string, Json>;

  if (version) rendered.version = version;
  if (releasedAt) rendered.releasedAt = releasedAt;

  const outputPath = resolve(outPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(rendered, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ template: resolve(templatePath), out: outputPath }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
