type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function reply(id: number, result: Json) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

const tools = [
  {
    name: "list_incidents",
    description: "List active incidents for the current account with filtering options.",
    inputSchema: {
      type: "object",
      properties: {
        team: { type: "string", description: "Filter by team identifier." },
        urgency: { type: "string", enum: ["high", "low"] },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: "get_on_call",
    description: "Return the current on-call user and escalation policy summary.",
    inputSchema: {
      type: "object",
      properties: {
        schedule_id: { type: "string" },
        include_escalation_policy: { type: "boolean" },
      },
    },
  },
];

const prompts = [
  {
    name: "incident_triage",
    description: "Prompt for triaging a new incident with clear next steps.",
    arguments: [{ name: "incident_id", required: true }],
  },
];

const resources = [
  {
    uri: "pagerduty://policies/default",
    name: "Default Policy",
    description: "Escalation policy summary for the default service.",
    mimeType: "application/json",
  },
];

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;

  while (buffer.includes("\n")) {
    const newlineIndex = buffer.indexOf("\n");
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);

    if (!line) continue;
    const message = JSON.parse(line) as { id?: number; method?: string };

    if (typeof message.id !== "number" || !message.method) continue;

    if (message.method === "initialize") {
      reply(message.id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: false },
          prompts: { listChanged: false },
          resources: { listChanged: false },
        },
        serverInfo: {
          name: "mock-pagerduty",
          version: "0.0.1",
        },
        instructions:
          "Use read-only tools by default. Summaries should be concise, incident-first, and avoid redundant schedule detail.",
      });
      continue;
    }

    if (message.method === "tools/list") {
      reply(message.id, { tools });
      continue;
    }

    if (message.method === "prompts/list") {
      reply(message.id, { prompts });
      continue;
    }

    if (message.method === "resources/list") {
      reply(message.id, { resources });
      continue;
    }

    reply(message.id, {});
  }
});
