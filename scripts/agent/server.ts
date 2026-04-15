#!/usr/bin/env tsx

/**
 * Tangle AI Dispatcher — REST API Server
 *
 * Endpoints:
 *   POST /api/agent/ask     — Send a message to the Tangle dispatcher agent
 *   POST /api/agent/resume  — Resume an interrupted agent thread (HITL)
 *   GET  /api/agent/health  — Health check
 */
import { EventEmitter } from "events";
import express from "express";

import { invokeDispatcher } from "./agents/tangleDispatcher";
import { config } from "./config";
import { loadSpecFromAiSpec } from "./mcp/csomTools";
import { loadDocsSearchService } from "./registry/docsSearchService";
import { loadSearchService } from "./registry/searchService";
import type { RecentPipelineRun } from "./session";
import { createSession } from "./session";

const app = express();

app.use(express.json({ limit: "10mb" }));

// CORS
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/agent/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

interface AskRequestBody {
  message: string;
  currentSpec?: Record<string, unknown>;
  threadId?: string;
  selectedEntityId?: string;
  recentRuns?: RecentPipelineRun[];
}

app.post("/api/agent/ask", async (req, res) => {
  const body = req.body as AskRequestBody;

  if (!body.message) {
    res.status(400).json({ error: '"message" field is required' });
    return;
  }

  console.log(
    `-> ${body.message.slice(0, 120)}${body.message.length > 120 ? "..." : ""}`,
  );

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const threadId = body.threadId ?? `thread-${Date.now()}`;
  res.write(`event: threadId\ndata: ${JSON.stringify({ threadId })}\n\n`);

  const emitter = new EventEmitter();
  emitter.on("command", (cmd: unknown) => {
    res.write(`event: command\ndata: ${JSON.stringify(cmd)}\n\n`);
  });
  emitter.on("status", (payload: unknown) => {
    res.write(`event: status\ndata: ${JSON.stringify(payload)}\n\n`);
  });

  const session = createSession({
    threadId,
    emitter,
    recentRuns: body.recentRuns,
  });

  if (body.currentSpec) {
    loadSpecFromAiSpec(body.currentSpec, session);
  }

  try {
    const result = await invokeDispatcher({
      message: body.message,
      threadId,
      selectedEntityId: body.selectedEntityId,
      session,
    });

    console.log(`<- Agent responded`);

    const componentReferences: Record<
      string,
      { name: string; yamlText: string }
    > = {};
    for (const [id, ref] of session.componentReferences) {
      if (result.answer.includes(`component://${id}`)) {
        componentReferences[id] = { name: ref.name, yamlText: ref.yamlText };
      }
    }

    const donePayload: Record<string, unknown> = {
      answer: result.answer,
      threadId: result.threadId,
    };
    if (Object.keys(componentReferences).length > 0) {
      donePayload.componentReferences = componentReferences;
    }

    res.write(`event: done\ndata: ${JSON.stringify(donePayload)}\n\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error:", message);
    res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    emitter.removeAllListeners();
    res.end();
  }
});

app.post("/api/agent/resume", async (req, res) => {
  try {
    const { threadId, decision } = req.body as {
      threadId: string;
      decision: unknown;
    };

    if (!threadId) {
      res.status(400).json({ error: '"threadId" is required' });
      return;
    }

    // Resume will be implemented when HITL is wired up
    res.json({
      message: "Resume not yet implemented",
      threadId,
      decision,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

async function main() {
  console.log("Loading component registry...");
  await loadSearchService();

  console.log("Loading docs index...");
  await loadDocsSearchService();

  app.listen(config.port, () => {
    console.log(
      `\nTangle AI Dispatcher running on http://localhost:${config.port}`,
    );
    console.log(`\nEndpoints:`);
    console.log(`  POST /api/agent/ask     — Chat with the Tangle dispatcher`);
    console.log(`  POST /api/agent/resume  — Resume interrupted thread`);
    console.log(`  GET  /api/agent/health  — Health check`);
    console.log(
      `\nExample:\n  curl -X POST http://localhost:${config.port}/api/agent/ask \\`,
    );
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(
      `    -d '{"message": "Build a pipeline that reads CSV, deduplicates, and uploads to S3"}'`,
    );
    console.log();
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
