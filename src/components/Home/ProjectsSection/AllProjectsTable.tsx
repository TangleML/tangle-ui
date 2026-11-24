import { useState } from "react";

import { PaginationControls } from "@/components/shared/PaginationControls";
import { ResizableTableHeader } from "@/components/shared/ResizableTableHeader";
import { BlockStack } from "@/components/ui/layout";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { useProjects } from "@/services/projects/useProjects";

import { ProjectCard } from "./ProjectCard";

const COLUMNS = [
  { name: "Name", width: 26 },
  { name: "Workspace", width: 18 },
  { name: "Resources", width: 26 },
  { name: "Created at", width: 17 },
  { name: "Updated at", width: 13 },
];

export function AllProjectsTable() {
  const [pageTokens, setPageTokens] = useState<string[]>([]);
  const page = useProjects({ pageSize: 10, pageToken: pageTokens.at(-1) });
  const projects = page.data?.items ?? [];
  const nextPageToken = page.data?.nextPageToken;
  const currentPage = pageTokens.length + 1;

  let message: string | undefined;
  if (page.isPending) message = "Loading projects…";
  else if (page.error) message = page.error.message;
  else if (projects.length === 0)
    message =
      currentPage > 1 ? "No projects on this page." : "No projects yet.";

  return (
    <BlockStack gap="4" className="min-w-0 w-full">
      <Table
        aria-label="All projects"
        aria-busy={page.isFetching}
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
            disabled={page.isFetching}
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
