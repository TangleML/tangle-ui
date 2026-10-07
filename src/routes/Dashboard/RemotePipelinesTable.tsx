import { useQuery } from "@tanstack/react-query";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBackend } from "@/providers/BackendProvider";
import { listRemotePipelines } from "@/services/remotePipelinesService";
import { formatDate } from "@/utils/date";

export function RemotePipelinesTable() {
  const { backendUrl, configured, available, ready } = useBackend();
  const {
    data: pipelines = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["remote-pipelines", backendUrl],
    queryFn: () => listRemotePipelines(backendUrl),
    enabled: ready && configured && available,
    refetchOnWindowFocus: false,
    retry: false,
  });

  let message: string | undefined;
  if (!ready) message = "Loading remote pipelines…";
  else if (!configured)
    message = "Configure a backend to view remote pipelines.";
  else if (!available) message = "Backend is unavailable.";
  else if (isLoading) message = "Loading remote pipelines…";
  else if (error) message = "Failed to load remote pipelines.";
  else if (pipelines.length === 0) message = "No remote pipelines found.";

  return (
    <Table aria-label="Remote Pipelines" className="table-fixed">
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead scope="col" className="w-[25%] truncate">
            Name
          </TableHead>
          <TableHead scope="col" className="w-[15%] truncate">
            ID
          </TableHead>
          <TableHead scope="col" className="w-[20%] truncate">
            User
          </TableHead>
          <TableHead scope="col" className="w-[12%] truncate">
            Created at
          </TableHead>
          <TableHead scope="col" className="w-[12%] truncate">
            Updated at
          </TableHead>
          <TableHead scope="col" className="w-[16%] truncate">
            Current version
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {message ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="whitespace-normal text-center text-muted-foreground"
            >
              {message}
            </TableCell>
          </TableRow>
        ) : (
          pipelines.map((pipeline) => (
            <TableRow key={pipeline.id}>
              <TruncatedTableCell>
                {pipeline.pipeline_name ?? "Untitled Pipeline"}
              </TruncatedTableCell>
              <TruncatedTableCell>{pipeline.id}</TruncatedTableCell>
              <TruncatedTableCell>{pipeline.user_id}</TruncatedTableCell>
              <TruncatedTableCell title={pipeline.created_at}>
                {formatDate(pipeline.created_at)}
              </TruncatedTableCell>
              <TruncatedTableCell title={pipeline.updated_at}>
                {formatDate(pipeline.updated_at)}
              </TruncatedTableCell>
              <TruncatedTableCell>
                {pipeline.current_version}
              </TruncatedTableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function TruncatedTableCell({
  children,
  title = children,
}: {
  children: string;
  title?: string;
}) {
  return (
    <TableCell>
      <span className="block truncate" title={title}>
        {children}
      </span>
    </TableCell>
  );
}
