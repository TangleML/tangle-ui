import { Link } from "@tanstack/react-router";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";

import { useFolderNavigation } from "../context/FolderNavigationContext";
import { useFavoriteFolders } from "../hooks/useFavoriteFolders";

const CARD_CLASS =
  "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer";

const FolderGridSkeleton = () => (
  <InlineStack gap="2" className="flex-wrap">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-9 w-32" />
    ))}
  </InlineStack>
);

export const FolderGrid = withSuspenseWrapper(function FolderGridContent() {
  const { data: favorites } = useFavoriteFolders();
  const folderNav = useFolderNavigation();

  if (favorites.length === 0) return null;

  return (
    <InlineStack gap="2" className="flex-wrap w-full border rounded-lg p-2">
      {favorites.map((folder) =>
        folderNav ? (
          <button
            key={folder.id}
            onClick={() => folderNav.navigateToFolder(folder.id)}
            className={CARD_CLASS}
          >
            <Icon
              name="FolderHeart"
              className="text-muted-foreground shrink-0"
              size="lg"
            />
            <Text size="sm">{folder.name}</Text>
          </button>
        ) : (
          <Link
            key={folder.id}
            to={APP_ROUTES.PIPELINE_FOLDERS}
            search={{ folderId: folder.id }}
            className={CARD_CLASS}
          >
            <Icon
              name="FolderHeart"
              className="text-muted-foreground shrink-0"
              size="lg"
            />
            <Text size="sm">{folder.name}</Text>
          </Link>
        ),
      )}
    </InlineStack>
  );
}, FolderGridSkeleton);
