import { useState } from "react";

import { CreatedByFilter } from "@/components/shared/CreatedByFilter/CreatedByFilter";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { ResizableTableHeader } from "@/components/shared/ResizableTableHeader";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { useDebouncedSearchValue } from "@/hooks/useDebouncedSearchValue";
import { useProjectAuthor } from "@/services/projects/useProjectAuthor";
import { useProjects } from "@/services/projects/useProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { ProjectCard } from "./ProjectCard";

const COLUMNS = [
  { name: "Name", width: 26 },
  { name: "Workspace", width: 18 },
  { name: "Resources", width: 26 },
  { name: "Created at", width: 17 },
  { name: "Updated at", width: 13 },
];

export function AllProjectsTable() {
  const { data: workspaces } = useWorkspaces();
  const author = useProjectAuthor();
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [user, setUser] = useState("");
  const [userInput, setUserInput, resetUserInput] =
    useDebouncedSearchValue(setUser);
  const [pageTokens, setPageTokens] = useState<string[]>([]);
  const creator = user.trim();
  const me = creator === "me";
  const waitingForCreator =
    userInput.trim() !== creator || (me && author.isPending);
  const missingAuthor = me && !author.createdBy;
  const page = useProjects(
    {
      createdBy: me ? author.createdBy : creator || undefined,
      workspaceId,
      pageSize: 10,
      pageToken: pageTokens.at(-1),
    },
    { enabled: !waitingForCreator && !missingAuthor },
  );
  const projects = page.data?.items ?? [];
  const currentPage = pageTokens.length + 1;
  const isBusy = waitingForCreator || page.isFetching;

  function applyUser(value: string) {
    resetUserInput(value);
    setUser(value);
    setPageTokens([]);
  }

  let message: string | undefined;
  if (waitingForCreator) message = "Loading projects…";
  else if (missingAuthor)
    message = author.error?.message ?? "Unable to identify the current user.";
  else if (page.isPending) message = "Loading projects…";
  else if (page.error) message = page.error.message;
  else if (projects.length === 0) {
    if (currentPage > 1) message = "No projects on this page.";
    else if (workspaceId || creator)
      message = "No projects match these filters.";
    else message = "No projects yet.";
  }
  const nextPageToken = !message && page.data?.nextPageToken;

  return (
    <BlockStack gap="4" className="min-w-0 w-full">
      <div role="search" aria-label="Project filters" className="w-full">
        <InlineStack gap="2" blockAlign="center">
          <CreatedByFilter
            value={userInput || undefined}
            onChange={(value) => {
              setUserInput(value ?? "");
              setPageTokens([]);
            }}
            onClear={() => applyUser("")}
            onSetMe={() => applyUser("me")}
          />
          <Select
            value={workspaceId ?? "all"}
            onValueChange={(id) => {
              setWorkspaceId(id === "all" ? undefined : id);
              setPageTokens([]);
            }}
          >
            <SelectTrigger aria-label="Filter by workspace" className="w-44">
              <Icon name="Shapes" size="xs" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workspaces</SelectItem>
              {workspaces?.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(userInput || workspaceId) && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Clear all filters"
              onClick={() => {
                applyUser("");
                setWorkspaceId(undefined);
              }}
            >
              <Icon name="X" size="sm" />
              Clear
            </Button>
          )}
        </InlineStack>
      </div>
      <Table
        aria-label="All projects"
        aria-busy={isBusy}
        className="min-w-[680px] table-fixed"
      >
        <ResizableTableHeader columns={COLUMNS} actionsClassName="w-12" />
        <TableBody>
          {message ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length + 1}
                className="whitespace-normal text-center"
              >
                <Text size="sm" tone="subdued">
                  {message}
                </Text>
              </TableCell>
            </TableRow>
          ) : (
            projects.map((project) => (
              <ProjectCard key={project.id} project={project} layout="table" />
            ))
          )}
        </TableBody>
      </Table>
      {(currentPage > 1 || nextPageToken) && (
        <nav aria-label="All projects pagination" className="w-full">
          <PaginationControls
            currentPage={currentPage}
            hasPreviousPage={currentPage > 1}
            hasNextPage={Boolean(nextPageToken)}
            disabled={isBusy}
            onNextPage={() => {
              if (nextPageToken) setPageTokens([...pageTokens, nextPageToken]);
            }}
            onPreviousPage={() => setPageTokens(pageTokens.slice(0, -1))}
            onReset={() => setPageTokens([])}
          />
        </nav>
      )}
    </BlockStack>
  );
}
