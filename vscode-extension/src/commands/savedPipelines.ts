import * as vscode from "vscode";

import type { TangleDeployCli } from "../cli/tangleDeployCli.ts";
import {
  askText,
  confirmWarning,
  guard,
  requireFilePath,
} from "./cliHelpers.ts";
import type { CommandMap } from "./pipelineRun.ts";

const PIPELINE_EXTS = [".yaml", ".yml"];

async function deploy(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(resource, PIPELINE_EXTS, "pipeline YAML");
  if (path) cli.runInTerminal(["saved-pipeline", "deploy", path]);
}

async function shipFromPython(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(resource, [".py"], "Python pipeline");
  if (path) {
    cli.runInTerminal(["saved-pipeline", "ship", "from-python", path]);
  }
}

function syncFromPython(cli: TangleDeployCli): void {
  cli.runInTerminal(["saved-pipeline", "sync", "from-python"], {
    execute: false,
  });
}

function list(cli: TangleDeployCli): void {
  cli.runInTerminal(["saved-pipeline", "list"]);
}

async function read(cli: TangleDeployCli): Promise<void> {
  const path = await askText("Read saved pipeline", {
    prompt: "Saved pipeline path.",
  });
  if (path?.trim()) cli.runInTerminal(["saved-pipeline", "read", path.trim()]);
}

async function run(cli: TangleDeployCli): Promise<void> {
  const path = await askText("Run saved pipeline", {
    prompt: "Saved pipeline path.",
  });
  if (path?.trim()) cli.runInTerminal(["saved-pipeline", "run", path.trim()]);
}

async function configure(cli: TangleDeployCli): Promise<void> {
  const path = await askText("Configure saved pipeline", {
    prompt: "Saved pipeline path.",
  });
  if (path?.trim()) {
    cli.runInTerminal(["saved-pipeline", "configure", path.trim()], {
      execute: false,
    });
  }
}

async function remove(cli: TangleDeployCli): Promise<void> {
  const target = await askText("Delete saved pipeline", {
    prompt: "Saved pipeline id or path.",
  });
  if (!target?.trim()) return;
  if (await confirmWarning(`Delete "${target.trim()}"?`, "Delete")) {
    cli.runInTerminal(["saved-pipeline", "delete", target.trim()]);
  }
}

function scheduleList(cli: TangleDeployCli): void {
  cli.runInTerminal(["saved-pipeline", "schedule", "list"]);
}

function scheduleManage(cli: TangleDeployCli): void {
  cli.runInTerminal(["saved-pipeline", "schedule"], { execute: false });
}

function subscriptionList(cli: TangleDeployCli): void {
  cli.runInTerminal(["saved-pipeline", "subscription", "list"]);
}

function subscriptionManage(cli: TangleDeployCli): void {
  cli.runInTerminal(["saved-pipeline", "subscription"], { execute: false });
}

export function savedPipelineCommands(cli: TangleDeployCli): CommandMap {
  return {
    "tangle.cli.deploySavedPipeline": guard(cli, (resource?: vscode.Uri) =>
      deploy(cli, resource),
    ),
    "tangle.cli.shipSavedPipeline": guard(cli, (resource?: vscode.Uri) =>
      shipFromPython(cli, resource),
    ),
    "tangle.cli.syncSavedPipeline": guard(cli, () => syncFromPython(cli)),
    "tangle.cli.listSavedPipelines": guard(cli, () => list(cli)),
    "tangle.cli.readSavedPipeline": guard(cli, () => read(cli)),
    "tangle.cli.runSavedPipeline": guard(cli, () => run(cli)),
    "tangle.cli.configureSavedPipeline": guard(cli, () => configure(cli)),
    "tangle.cli.deleteSavedPipeline": guard(cli, () => remove(cli)),
    "tangle.cli.listSchedules": guard(cli, () => scheduleList(cli)),
    "tangle.cli.manageSchedule": guard(cli, () => scheduleManage(cli)),
    "tangle.cli.listSubscriptions": guard(cli, () => subscriptionList(cli)),
    "tangle.cli.manageSubscription": guard(cli, () => subscriptionManage(cli)),
  };
}
