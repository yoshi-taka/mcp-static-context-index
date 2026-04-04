import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type AwsCatalog = {
  vendor: string;
  repoUrl: string;
  packagePrefix: string;
  transport: string;
  defaultCommand: string;
  defaultEnv?: Record<string, string>;
  servers: AwsServerEntry[];
};

type AwsServerEntry = {
  id: string;
  package: string;
  category: string;
  authMode: string;
  measured?: boolean;
};

function usage() {
  console.error(
    "Usage: bun run scripts/generate-aws-config.ts --id <server-id> [--catalog <path>] [--out <path>]",
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let id = "";
  let catalogPath = "configs/aws-catalog.json";
  let outPath = "";

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];

    if (part === "--id") {
      id = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (part === "--catalog") {
      catalogPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (part === "--out") {
      outPath = argv[i + 1] ?? "";
      i += 1;
    }
  }

  if (!id) usage();
  return { id, catalogPath, outPath };
}

function titleCase(input: string) {
  const special: Record<string, string> = {
    appsync: "AppSync",
    aws: "AWS",
    cdk: "CDK",
    cfn: "CFN",
    cloudwatch: "CloudWatch",
    cloudtrail: "CloudTrail",
    ccapi: "CCAPI",
    dsql: "DSQL",
    dynamodb: "DynamoDB",
    ecs: "ECS",
    eks: "EKS",
    iam: "IAM",
    iac: "IaC",
    iot: "IoT",
    msk: "MSK",
    mq: "MQ",
    sns: "SNS",
    sqs: "SQS",
    api: "API",
    bedrock: "Bedrock",
    kb: "KB",
    nova: "Nova",
    openapi: "OpenAPI",
    postgres: "Postgres",
    prometheus: "Prometheus",
    qbusiness: "QBusiness",
    qindex: "QIndex",
    s3: "S3",
    sagemaker: "SageMaker",
    security: "Security",
    serverless: "Serverless",
    sql: "SQL",
    support: "Support",
    terraform: "Terraform",
  };

  return input
    .split("-")
    .filter(Boolean)
    .map((part) => special[part] ?? part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const { id, catalogPath, outPath } = parseArgs(process.argv.slice(2));
  const catalog = JSON.parse(await readFile(resolve(catalogPath), "utf8")) as AwsCatalog;
  const entry = catalog.servers.find((server) => server.id === id);
  const executableOverrides: Record<string, string[]> = {
    ecs: ["--from", "awslabs.ecs-mcp-server", "ecs-mcp-server"],
  };

  if (!entry) {
    console.error(`AWS catalog entry not found: ${id}`);
    process.exit(1);
  }

  const targetPath = resolve(outPath || `configs/${id}.local.json`);
  const config = {
    id: entry.id,
    name: `${titleCase(entry.id)} MCP Server`,
    vendor: catalog.vendor,
    category: entry.category,
    repoUrl: `${catalog.repoUrl}/tree/main/src/${entry.id}-mcp-server`,
    version: "unknown",
    releasedAt: new Date().toISOString().slice(0, 10),
    status: "measured",
    transport: {
      command: catalog.defaultCommand,
      args: executableOverrides[entry.id] ?? [entry.package],
      env: catalog.defaultEnv ?? {},
    },
  };

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      id: entry.id,
      authMode: entry.authMode,
      out: targetPath,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
