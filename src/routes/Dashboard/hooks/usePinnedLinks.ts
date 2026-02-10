import { useState } from "react";

import type { ListPipelineJobsResponse } from "@/api/types.gen";
import { APP_ROUTES, EDITOR_PATH } from "@/routes/router";
import { getPinnedItems, setPinnedItem } from "@/utils/pinnedItems";

import type { RecentLinkItem } from "../types";

function loadPinnedLinks(): RecentLinkItem[] {
  return getPinnedItems()
    .filter(
      (item): item is RecentLinkItem =>
        item.type === "run" || item.type === "pipeline",
    )
    .map((item) => ({ ...item }));
}

export function usePinnedLinks(pipelineNames: Set<string>) {
  const [pinnedLinks, setPinnedLinks] =
    useState<RecentLinkItem[]>(loadPinnedLinks);

  const updateFromStorage = () => setPinnedLinks(loadPinnedLinks());

  const pinnedItems = pinnedLinks.filter((item) =>
    item.type === "pipeline" ? pipelineNames.has(item.title) : true,
  );
  const pinnedUrls = new Set(pinnedItems.map((item) => item.url));
  const pinnedRunUrls = new Set(
    pinnedItems.filter((item) => item.type === "run").map((item) => item.url),
  );

  const handleToggleRunPinned = (
    run: ListPipelineJobsResponse["pipeline_runs"][number],
  ) => {
    const url = `${APP_ROUTES.RUNS}/${run.id}`;
    setPinnedItem(
      { title: run.pipeline_name ?? `Run ${run.id}`, type: "run", url },
      !pinnedRunUrls.has(url),
    );
    updateFromStorage();
  };

  const handleTogglePipelinePinned = (name: string) => {
    const url = `${EDITOR_PATH}/${encodeURIComponent(name)}`;
    setPinnedItem({ title: name, type: "pipeline", url }, !pinnedUrls.has(url));
    updateFromStorage();
  };

  const handleTogglePinnedLink = (item: RecentLinkItem) => {
    setPinnedItem(
      { title: item.title, type: item.type, url: item.url },
      !pinnedUrls.has(item.url),
    );
    updateFromStorage();
  };

  return {
    pinnedItems,
    pinnedUrls,
    pinnedRunUrls,
    handleToggleRunPinned,
    handleTogglePipelinePinned,
    handleTogglePinnedLink,
  };
}
