import { useNavigate } from "@tanstack/react-router";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/router";
import { useFolderNavigation } from "@/routes/v2/pages/PipelineFolders/context/FolderNavigationContext";
import type { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";

interface ParentFolderRowProps {
  breadcrumbPath: PipelineFolder[];
}

export function ParentFolderRow({ breadcrumbPath }: ParentFolderRowProps) {
  const navigate = useNavigate();
  const folderNav = useFolderNavigation();
  const { track } = useAnalytics();

  const parentId = breadcrumbPath[breadcrumbPath.length - 1]?.parentId ?? null;

  const handleNavigateUp = () => {
    track("v2.pipeline_folders.table.parent_folder_opened", {
      navigation_context: folderNav ? "embedded" : "route",
    });
    if (folderNav) {
      folderNav.navigateToFolder(parentId);
    } else {
      navigate({
        to: APP_ROUTES.PIPELINE_FOLDERS,
        search: parentId ? { folderId: parentId } : {},
      });
    }
  };

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={handleNavigateUp}
    >
      <TableCell />
      <TableCell>
        <InlineStack gap="2" blockAlign="center">
          <Icon name="CornerLeftUp" tone="subdued" />
          <Text size="sm" tone="subdued">
            ..
          </Text>
        </InlineStack>
      </TableCell>
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell />
    </TableRow>
  );
}
