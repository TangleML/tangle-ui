import * as vscode from "vscode";

import { parseArgsJson } from "../cli/cliInvocation.ts";
import type { TangleDeployCli } from "../cli/tangleDeployCli.ts";
import type { RunNode } from "../runsTree.ts";
import {
  askOutputPath,
  askText,
  guard,
  openVirtualDocument,
  requireFilePath,
} from "./cliHelpers.ts";

export type CommandMap = Record<string, (...args: never[]) => unknown>;

const PIPELINE_EXTS = [".yaml", ".yml"];
const PIPELINE_SOURCE_EXTS = [".yaml", ".yml", ".py"];

function isPython(path: string): boolean {
  return path.toLowerCase().endsWith(".py");
}

async function submitArgs(path: string): Promise<string[] | undefined> {
  const input = await askText("Pipeline arguments (optional JSON object)", {
    placeHolder: '{"date": "2024-01-01"}',
  });
  if (input === undefined) return undefined;
  const base = isPython(path)
    ? ["pipeline-run", "submit-from-python", path]
    : ["pipeline-run", "submit", path];
  const trimmed = input.trim();
  return trimmed ? [...base, "--args", parseArgsJson(trimmed)] : base;
}

async function submitPipeline(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(
    resource,
    PIPELINE_SOURCE_EXTS,
    "pipeline",
  );
  if (!path) return;
  const args = await submitArgs(path);
  if (args) cli.runInTerminal(args);
}

async function validatePipeline(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(resource, PIPELINE_EXTS, "pipeline YAML");
  if (path) cli.runInTerminal(["pipeline-run", "validate", path]);
}

async function viewPipeline(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(resource, PIPELINE_EXTS, "pipeline YAML");
  if (path) cli.runInTerminal(["pipeline", "view", path]);
}

async function diagramPipeline(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(resource, PIPELINE_EXTS, "pipeline YAML");
  if (!path) return;
  const result = await cli.capture(["pipeline-run", "diagram", path]);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "Could not generate the diagram.");
  }
  await openVirtualDocument(result.stdout, "markdown");
}

function searchRuns(cli: TangleDeployCli): void {
  cli.runInTerminal(["pipeline-run", "search", "--created-by", "me"]);
}

function cancelRun(cli: TangleDeployCli, node: RunNode): void {
  cli.runInTerminal(["pipeline-run", "cancel", node.run.id]);
}

function runLogs(cli: TangleDeployCli, node: RunNode): void {
  cli.runInTerminal(["pipeline-run", "logs", node.run.rootExecutionId]);
}

function runDetails(cli: TangleDeployCli, node: RunNode): void {
  cli.runInTerminal(["pipeline-run", "details", node.run.id]);
}

async function exportRun(cli: TangleDeployCli, node: RunNode): Promise<void> {
  const output = await askOutputPath(`${node.run.id}.yaml`);
  if (output)
    cli.runInTerminal(["pipeline-run", "export", node.run.id, output]);
}

export function pipelineRunCommands(cli: TangleDeployCli): CommandMap {
  return {
    "tangle.cli.submitPipeline": guard(cli, (resource?: vscode.Uri) =>
      submitPipeline(cli, resource),
    ),
    "tangle.cli.validatePipeline": guard(cli, (resource?: vscode.Uri) =>
      validatePipeline(cli, resource),
    ),
    "tangle.cli.viewPipeline": guard(cli, (resource?: vscode.Uri) =>
      viewPipeline(cli, resource),
    ),
    "tangle.cli.diagramPipeline": guard(cli, (resource?: vscode.Uri) =>
      diagramPipeline(cli, resource),
    ),
    "tangle.cli.searchRuns": guard(cli, () => searchRuns(cli)),
    "tangle.cli.cancelRun": guard(cli, (node: RunNode) => cancelRun(cli, node)),
    "tangle.cli.runLogs": guard(cli, (node: RunNode) => runLogs(cli, node)),
    "tangle.cli.runDetails": guard(cli, (node: RunNode) =>
      runDetails(cli, node),
    ),
    "tangle.cli.exportRun": guard(cli, (node: RunNode) => exportRun(cli, node)),
  };
}
