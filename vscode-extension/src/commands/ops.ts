import type { TangleDeployCli } from "../cli/tangleDeployCli.ts";
import type { RunNode } from "../runsTree.ts";
import { askFolder, askText, confirmWarning, guard } from "./cliHelpers.ts";
import type { CommandMap } from "./pipelineRun.ts";

function whoami(cli: TangleDeployCli): void {
  cli.runInTerminal(["auth", "whoami"]);
}

function listSecrets(cli: TangleDeployCli): void {
  cli.runInTerminal(["secrets", "list"]);
}

function createSecret(cli: TangleDeployCli): void {
  cli.runInTerminal(["secrets", "create"], { execute: false });
}

async function deleteSecret(cli: TangleDeployCli): Promise<void> {
  const name = await askText("Delete secret", { prompt: "Secret name." });
  if (!name?.trim()) return;
  if (await confirmWarning(`Delete secret "${name.trim()}"?`, "Delete")) {
    cli.runInTerminal(["secrets", "delete", name.trim()]);
  }
}

function listRunAnnotations(cli: TangleDeployCli, node: RunNode): void {
  cli.runInTerminal(["pipeline-run", "annotations", "list", node.run.id]);
}

function setRunAnnotation(cli: TangleDeployCli, node: RunNode): void {
  cli.runInTerminal(["pipeline-run", "annotations", "set", node.run.id], {
    execute: false,
  });
}

function getArtifacts(cli: TangleDeployCli, node: RunNode): void {
  cli.runInTerminal(["artifacts", "get", node.run.id]);
}

async function downloadArtifacts(
  cli: TangleDeployCli,
  node: RunNode,
): Promise<void> {
  const dir = await askFolder();
  if (dir) {
    cli.runInTerminal([
      "artifacts",
      "download",
      node.run.rootExecutionId,
      "--output-dir",
      dir,
    ]);
  }
}

function listQuotaGroups(cli: TangleDeployCli): void {
  cli.runInTerminal(["quota-group", "list"]);
}

function manageQuotaGroup(cli: TangleDeployCli): void {
  cli.runInTerminal(["quota-group"], { execute: false });
}

function docs(cli: TangleDeployCli): void {
  cli.runInTerminal(["docs"]);
}

function quickstart(cli: TangleDeployCli): void {
  cli.runInTerminal(["quickstart"]);
}

export function opsCommands(cli: TangleDeployCli): CommandMap {
  return {
    "tangle.cli.whoami": guard(cli, () => whoami(cli)),
    "tangle.cli.listSecrets": guard(cli, () => listSecrets(cli)),
    "tangle.cli.createSecret": guard(cli, () => createSecret(cli)),
    "tangle.cli.deleteSecret": guard(cli, () => deleteSecret(cli)),
    "tangle.cli.listRunAnnotations": guard(cli, (node: RunNode) =>
      listRunAnnotations(cli, node),
    ),
    "tangle.cli.setRunAnnotation": guard(cli, (node: RunNode) =>
      setRunAnnotation(cli, node),
    ),
    "tangle.cli.getArtifacts": guard(cli, (node: RunNode) =>
      getArtifacts(cli, node),
    ),
    "tangle.cli.downloadArtifacts": guard(cli, (node: RunNode) =>
      downloadArtifacts(cli, node),
    ),
    "tangle.cli.listQuotaGroups": guard(cli, () => listQuotaGroups(cli)),
    "tangle.cli.manageQuotaGroup": guard(cli, () => manageQuotaGroup(cli)),
    "tangle.cli.docs": guard(cli, () => docs(cli)),
    "tangle.cli.quickstart": guard(cli, () => quickstart(cli)),
  };
}
