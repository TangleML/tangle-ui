import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";

import {
  activeWorkspaces,
  type Project,
  type TangleRestClient,
  type Workspace,
} from "../tangleRestClient.ts";
import { SelectList } from "./SelectList.tsx";
import { TextInput } from "./TextInput.tsx";

interface ProjectScreenProps {
  tangle: TangleRestClient;
  onOpen: (project: Project) => void;
}

type Stage = "list" | "name" | "workspace";

export function ProjectScreen({ tangle, onOpen }: ProjectScreenProps) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [stage, setStage] = useState<Stage>("list");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([tangle.listAllProjects(), tangle.listWorkspaces()])
      .then(([loadedProjects, loadedWorkspaces]) => {
        if (cancelled) return;
        setProjects(loadedProjects);
        setWorkspaces(loadedWorkspaces);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [tangle]);

  useInput(
    (input) => {
      if (input === "n") {
        setError(null);
        setStage("name");
      }
    },
    { isActive: stage === "list" && !busy },
  );

  const choices = activeWorkspaces(workspaces);

  function onNameSubmit(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    setName(trimmed);
    if (choices.length === 0) {
      setError("No active workspace is available to create a project in.");
      setStage("list");
      return;
    }
    if (choices.length === 1) {
      void create(trimmed, choices[0]);
      return;
    }
    setStage("workspace");
  }

  async function create(
    projectName: string,
    workspace: Workspace,
  ): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const project = await tangle.createProject(projectName, workspace.id);
      onOpen(project);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      setStage("list");
    }
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color="magenta">
        Projects
      </Text>
      {projects === null && !error ? (
        <Text dimColor>Loading projects…</Text>
      ) : null}
      {error ? <Text color="red">{error}</Text> : null}

      {stage === "list" && projects ? (
        <Box marginTop={1} flexDirection="column">
          <SelectList
            items={projects}
            getKey={(project) => project.id}
            getLabel={(project) => project.name}
            onSelect={onOpen}
            isActive={!busy}
            emptyLabel="No projects yet. Press n to create one."
          />
          <Box marginTop={1}>
            <Text dimColor>
              ↑/↓ to move · Enter to open · n to create a project
            </Text>
          </Box>
        </Box>
      ) : null}

      {stage === "name" ? (
        <Box marginTop={1} flexDirection="column">
          <Text>New project name:</Text>
          <TextInput
            value={name}
            onChange={setName}
            onSubmit={onNameSubmit}
            isActive={!busy}
            placeholder="my-project"
          />
          {busy ? <Text dimColor>Creating…</Text> : null}
        </Box>
      ) : null}

      {stage === "workspace" ? (
        <Box marginTop={1} flexDirection="column">
          <Text>Workspace for “{name}”:</Text>
          <Box marginTop={1}>
            <SelectList
              items={choices}
              getKey={(workspace) => workspace.id}
              getLabel={(workspace) => workspace.name ?? workspace.id}
              onSelect={(workspace) => void create(name, workspace)}
              isActive={!busy}
            />
          </Box>
          {busy ? <Text dimColor>Creating…</Text> : null}
        </Box>
      ) : null}
    </Box>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
