import { type Dispatch, type SetStateAction, useState } from "react";

import type { PipelineRunResponse } from "@/api/types.gen";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import RunBulkActionsBar from "./RunBulkActionsBar";
import RunRow from "./RunRow";

export function RunTable({
  runs,
  responsive = false,
  showHeader = true,
  onFilterByUser,
  onRunClick,
  selection,
}: {
  runs: PipelineRunResponse[];
  responsive?: boolean;
  showHeader?: boolean;
  onFilterByUser?: (user: string) => void;
  onRunClick?: (run: PipelineRunResponse) => void;
  selection?: {
    selectedRuns: Set<string>;
    setSelectedRuns: Dispatch<SetStateAction<Set<string>>>;
  };
}) {
  const compareEnabled = useFlagValue("compare-runs");
  const [localSelection, setLocalSelection] = useState<Set<string>>(new Set());
  const { selectedRuns, setSelectedRuns } = selection ?? {
    selectedRuns: localSelection,
    setSelectedRuns: setLocalSelection,
  };
  const allSelected =
    runs.length > 0 && runs.every((run) => selectedRuns.has(`${run.id}`));
  function toggleRun(id: string) {
    setSelectedRuns((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedRuns((previous) => {
      const next = new Set(previous);
      runs.forEach((run) => {
        if (allSelected) next.delete(`${run.id}`);
        else next.add(`${run.id}`);
      });
      return next;
    });
  }
  return (
    <>
      <Table
        className={cn(responsive && "table-fixed")}
        containerClassName={cn(
          responsive && "overflow-hidden rounded-lg border border-border",
        )}
      >
        <colgroup>
          {compareEnabled && (
            <col
              className={cn(
                "w-8",
                responsive && "hidden @[52rem]/dashboard-section:table-column",
              )}
            />
          )}
          <col
            className={
              responsive
                ? "w-full @[36rem]/dashboard-section:w-1/2 @[52rem]/dashboard-section:w-1/3"
                : "w-1/4"
            }
          />
          <col
            className={
              responsive
                ? "hidden w-1/4 @[36rem]/dashboard-section:table-column @[52rem]/dashboard-section:w-1/6"
                : "w-1/4"
            }
          />
          <col
            className={
              responsive
                ? "hidden w-1/4 @[36rem]/dashboard-section:table-column @[52rem]/dashboard-section:w-1/6"
                : "w-3/20"
            }
          />
          <col
            className={
              responsive
                ? "hidden w-1/6 @[52rem]/dashboard-section:table-column"
                : "w-3/20"
            }
          />
          <col
            className={
              responsive
                ? "hidden w-1/6 @[52rem]/dashboard-section:table-column"
                : "w-1/5"
            }
          />
          <col
            className={cn(
              "w-28",
              responsive && "hidden @[52rem]/dashboard-section:table-column",
            )}
          />
        </colgroup>
        {showHeader && (
          <TableHeader className={cn(responsive && "bg-muted/20 [&_th]:px-4")}>
            <TableRow className="text-xs">
              {compareEnabled && (
                <TableHead
                  className={cn(
                    responsive &&
                      "hidden @[52rem]/dashboard-section:table-cell",
                  )}
                >
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all runs on this page"
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead
                className={cn(
                  responsive && "hidden @[36rem]/dashboard-section:table-cell",
                )}
              >
                Status
              </TableHead>
              <TableHead
                className={cn(
                  responsive && "hidden @[36rem]/dashboard-section:table-cell",
                )}
              >
                Date
              </TableHead>
              <TableHead
                className={cn(
                  responsive && "hidden @[52rem]/dashboard-section:table-cell",
                )}
              >
                Initiated By
              </TableHead>
              <TableHead
                className={cn(
                  responsive && "hidden @[52rem]/dashboard-section:table-cell",
                )}
              >
                Tags
              </TableHead>
              <TableHead
                className={cn(
                  responsive && "hidden @[52rem]/dashboard-section:table-cell",
                )}
              >
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
        )}
        <TableBody
          className={cn(responsive && "[&_td]:h-12 [&_td]:px-4 [&_td]:py-2")}
        >
          {runs.map((run, index) => (
            <RunRow
              key={run.id}
              run={run}
              responsive={responsive}
              overflow={index >= 5}
              onFilterByUser={onFilterByUser}
              selectable={compareEnabled}
              isSelected={selectedRuns.has(`${run.id}`)}
              onToggleSelected={toggleRun}
              onRunClick={onRunClick}
            />
          ))}
        </TableBody>
      </Table>
      {compareEnabled && selectedRuns.size > 0 && (
        <RunBulkActionsBar
          selectedRuns={Array.from(selectedRuns)}
          onClearSelection={() => setSelectedRuns(new Set())}
        />
      )}
    </>
  );
}
