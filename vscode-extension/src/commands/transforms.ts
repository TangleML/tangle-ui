import path from "node:path";

import * as vscode from "vscode";

import type { TangleDeployCli } from "../cli/tangleDeployCli.ts";
import {
  askOutputPath,
  guard,
  openVirtualDocument,
  requireFilePath,
} from "./cliHelpers.ts";
import type { CommandMap } from "./pipelineRun.ts";

const PIPELINE_EXTS = [".yaml", ".yml"];

function stem(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

async function transformToFile(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
  spec: { exts: string[]; noun: string; verb: string[]; suffix: string },
): Promise<void> {
  const input = await requireFilePath(resource, spec.exts, spec.noun);
  if (!input) return;
  const output = await askOutputPath(`${stem(input)}.${spec.suffix}`);
  if (output) cli.runInTerminal([...spec.verb, input, output]);
}

function hydrate(cli: TangleDeployCli, resource: vscode.Uri | undefined) {
  return transformToFile(cli, resource, {
    exts: PIPELINE_EXTS,
    noun: "pipeline YAML",
    verb: ["pipeline", "hydrate"],
    suffix: "hydrated.yaml",
  });
}

function dehydrate(cli: TangleDeployCli, resource: vscode.Uri | undefined) {
  return transformToFile(cli, resource, {
    exts: PIPELINE_EXTS,
    noun: "pipeline YAML",
    verb: ["pipeline", "dehydrate"],
    suffix: "template.yaml",
  });
}

async function autoLayout(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const input = await requireFilePath(resource, PIPELINE_EXTS, "pipeline YAML");
  if (!input) return;
  const output = await askOutputPath(`${stem(input)}.layout.yaml`);
  if (output) {
    cli.runInTerminal(["pipeline", "auto-layout", input, "-o", output]);
  }
}

async function compileFromPython(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const input = await requireFilePath(resource, [".py"], "Python pipeline");
  if (!input) return;
  const output = await askOutputPath(`${stem(input)}.yaml`);
  if (output) {
    cli.runInTerminal([
      "pipeline",
      "compile",
      "from-python",
      input,
      "-o",
      output,
    ]);
  }
}

async function decompile(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const input = await requireFilePath(resource, PIPELINE_EXTS, "pipeline YAML");
  if (!input) return;
  const output = await askOutputPath(`${stem(input)}.py`);
  if (output) cli.runInTerminal(["pipeline", "decompile", input, "-o", output]);
}

async function generateSchema(cli: TangleDeployCli): Promise<void> {
  const result = await cli.capture(["pipeline", "generate-schema"]);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "Could not generate the schema.");
  }
  await openVirtualDocument(result.stdout, "json");
}

async function convertFromAirflow(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const input = await requireFilePath(resource, [".py"], "Airflow DAG");
  if (input) {
    cli.runInTerminal(["pipeline", "convert", "from-airflow", input], {
      execute: false,
    });
  }
}

export function transformCommands(cli: TangleDeployCli): CommandMap {
  return {
    "tangle.cli.hydratePipeline": guard(cli, (resource?: vscode.Uri) =>
      hydrate(cli, resource),
    ),
    "tangle.cli.dehydratePipeline": guard(cli, (resource?: vscode.Uri) =>
      dehydrate(cli, resource),
    ),
    "tangle.cli.autoLayoutPipeline": guard(cli, (resource?: vscode.Uri) =>
      autoLayout(cli, resource),
    ),
    "tangle.cli.compilePipelineFromPython": guard(
      cli,
      (resource?: vscode.Uri) => compileFromPython(cli, resource),
    ),
    "tangle.cli.decompilePipeline": guard(cli, (resource?: vscode.Uri) =>
      decompile(cli, resource),
    ),
    "tangle.cli.generatePipelineSchema": guard(cli, () => generateSchema(cli)),
    "tangle.cli.convertFromAirflow": guard(cli, (resource?: vscode.Uri) =>
      convertFromAirflow(cli, resource),
    ),
  };
}
