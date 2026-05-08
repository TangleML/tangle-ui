import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { IssueResolutionWindowContent } from "./IssueResolutionWindowContent";

const ISSUE_RESOLUTION_WINDOW_ID = "issue-resolution";

export function useIssueResolutionWindow() {
  const { windows } = useSharedStores();

  return () =>
    windows.openWindow(<IssueResolutionWindowContent />, {
      id: ISSUE_RESOLUTION_WINDOW_ID,
      title: "Fix Issues",
      size: { width: 360, height: 360 },
      startVisible: true,
    });
}
