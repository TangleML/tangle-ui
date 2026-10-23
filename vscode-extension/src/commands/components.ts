import * as vscode from "vscode";

import type { TangleDeployCli } from "../cli/tangleDeployCli.ts";
import { askText, guard, requireFilePath } from "./cliHelpers.ts";
import type { CommandMap } from "./pipelineRun.ts";

const COMPONENT_EXTS = [".yaml", ".yml"];

async function publish(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(
    resource,
    COMPONENT_EXTS,
    "component YAML",
  );
  if (!path) return;
  const image = await askText("Container image (optional)", {
    placeHolder: "us-docker.pkg.dev/.../image:tag",
  });
  if (image === undefined) return;
  const args = ["component", "publish", path];
  if (image.trim()) args.push("--image", image.trim());
  cli.runInTerminal(args);
}

async function publishAll(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(
    resource,
    COMPONENT_EXTS,
    "publish config",
  );
  if (path) cli.runInTerminal(["component", "publish-all", "--config", path]);
}

async function generateFromPython(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(resource, [".py"], "Python source");
  if (path) cli.runInTerminal(["component", "generate", "from-python", path]);
}

function generateFromDbt(cli: TangleDeployCli): void {
  cli.runInTerminal(["component", "generate", "from-dbt"], { execute: false });
}

async function generateFromDocker(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(resource, ["dockerfile"], "Dockerfile");
  if (path) {
    cli.runInTerminal(["component", "generate", "from-docker", path], {
      execute: false,
    });
  }
}

async function inspect(cli: TangleDeployCli): Promise<void> {
  const query = await askText("Inspect component", {
    prompt: "Component name or digest.",
  });
  if (query?.trim()) cli.runInTerminal(["component", "inspect", query.trim()]);
}

async function search(cli: TangleDeployCli): Promise<void> {
  const query = await askText("Search components", {
    prompt: "Name, publisher, or digest.",
  });
  if (query?.trim()) cli.runInTerminal(["component", "search", query.trim()]);
}

async function bumpVersion(
  cli: TangleDeployCli,
  resource: vscode.Uri | undefined,
): Promise<void> {
  const path = await requireFilePath(
    resource,
    COMPONENT_EXTS,
    "component YAML",
  );
  if (path) cli.runInTerminal(["component", "bump-version", path]);
}

async function deprecate(cli: TangleDeployCli): Promise<void> {
  const digest = await askText("Deprecate component", {
    prompt: "Component digest to deprecate.",
  });
  if (digest?.trim()) {
    cli.runInTerminal(["component", "deprecate", digest.trim()]);
  }
}

export function componentCommands(cli: TangleDeployCli): CommandMap {
  return {
    "tangle.cli.publishComponent": guard(cli, (resource?: vscode.Uri) =>
      publish(cli, resource),
    ),
    "tangle.cli.publishAllComponents": guard(cli, (resource?: vscode.Uri) =>
      publishAll(cli, resource),
    ),
    "tangle.cli.generateComponentFromPython": guard(
      cli,
      (resource?: vscode.Uri) => generateFromPython(cli, resource),
    ),
    "tangle.cli.generateComponentFromDbt": guard(cli, () =>
      generateFromDbt(cli),
    ),
    "tangle.cli.generateComponentFromDocker": guard(
      cli,
      (resource?: vscode.Uri) => generateFromDocker(cli, resource),
    ),
    "tangle.cli.inspectComponent": guard(cli, () => inspect(cli)),
    "tangle.cli.searchComponents": guard(cli, () => search(cli)),
    "tangle.cli.bumpComponentVersion": guard(cli, (resource?: vscode.Uri) =>
      bumpVersion(cli, resource),
    ),
    "tangle.cli.deprecateComponent": guard(cli, () => deprecate(cli)),
  };
}
