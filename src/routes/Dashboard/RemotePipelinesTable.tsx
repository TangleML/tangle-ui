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
    <Table aria-label="Remote Pipelines">
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead scope="col">Name</TableHead>
          <TableHead scope="col">ID</TableHead>
          <TableHead scope="col">User</TableHead>
          <TableHead scope="col">Created at</TableHead>
          <TableHead scope="col">Updated at</TableHead>
          <TableHead scope="col">Current version</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {message ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-center text-muted-foreground"
            >
              {message}
            </TableCell>
          </TableRow>
        ) : (
          pipelines.map((pipeline) => (
            <TableRow key={pipeline.id}>
              <TableCell>
                {pipeline.pipeline_name ?? "Untitled Pipeline"}
              </TableCell>
              <TableCell>{pipeline.id}</TableCell>
              <TableCell>{pipeline.user_id}</TableCell>
              <TableCell>{formatDate(pipeline.created_at)}</TableCell>
              <TableCell>{formatDate(pipeline.updated_at)}</TableCell>
              <TableCell>{pipeline.current_version}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
