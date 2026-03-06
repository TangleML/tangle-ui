import { Link } from "@tanstack/react-router";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/router";

import { useFolderNavigation } from "../context/FolderNavigationContext";
import { useFolderBreadcrumbs } from "../hooks/useFolderBreadcrumbs";
import { useToggleFavorite } from "../hooks/useFolderMutations";

interface FolderBreadcrumbProps {
  folderId: string | null;
}

const FolderBreadcrumbSkeleton = () => <Skeleton className="h-5 w-48" />;

export const FolderBreadcrumb = withSuspenseWrapper(
  function FolderBreadcrumbContent({ folderId }: FolderBreadcrumbProps) {
    const { data: path } = useFolderBreadcrumbs(folderId);
    const { mutate: toggleFavorite, isPending } = useToggleFavorite();
    const folderNav = useFolderNavigation();

    const renderFolderLink = (targetFolderId: string | null, label: string) => {
      if (folderNav) {
        return (
          <BreadcrumbLink asChild>
            <button onClick={() => folderNav.navigateToFolder(targetFolderId)}>
              {label}
            </button>
          </BreadcrumbLink>
        );
      }
      return (
        <BreadcrumbLink asChild>
          <Link
            to={APP_ROUTES.PIPELINE_FOLDERS}
            search={targetFolderId ? { folderId: targetFolderId } : {}}
          >
            {label}
          </Link>
        </BreadcrumbLink>
      );
    };

    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {folderId === null ? (
              <BreadcrumbPage>Pipelines</BreadcrumbPage>
            ) : (
              renderFolderLink(null, "Pipelines")
            )}
          </BreadcrumbItem>

          {path.map((folder, index) => {
            const isLast = index === path.length - 1;
            return (
              <BreadcrumbItem key={folder.id}>
                <BreadcrumbSeparator />
                {isLast ? (
                  <BreadcrumbPage>
                    <InlineStack gap="1" blockAlign="center">
                      {folder.name}
                      <Button
                        variant="ghost"
                        size="min"
                        disabled={isPending}
                        onClick={() => toggleFavorite(folder.id)}
                      >
                        <Icon
                          name="Heart"
                          className={cn(
                            "size-4",
                            folder.favorite
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground",
                          )}
                        />
                      </Button>
                    </InlineStack>
                  </BreadcrumbPage>
                ) : (
                  renderFolderLink(folder.id, folder.name)
                )}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    );
  },
  FolderBreadcrumbSkeleton,
);
