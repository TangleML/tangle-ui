import { useNavigate } from "@tanstack/react-router";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";

import { useFolderNavigation } from "../../../context/FolderNavigationContext";
import type { PipelineFolder } from "../../../types";

interface ParentFolderRowProps {
  breadcrumbPath: PipelineFolder[];
}

export function ParentFolderRow({ breadcrumbPath }: ParentFolderRowProps) {
  const navigate = useNavigate();
  const folderNav = useFolderNavigation();

  const parentId = breadcrumbPath[breadcrumbPath.length - 1]?.parentId ?? null;

  const handleNavigateUp = () => {
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
          <Icon
            name="CornerLeftUp"
            className="text-muted-foreground shrink-0"
          />
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
