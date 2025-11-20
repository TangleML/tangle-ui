import { useSuspenseQuery } from "@tanstack/react-query";
import { PackagePlus, Star } from "lucide-react";
import type { MouseEvent, PropsWithChildren } from "react";
import { useCallback, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { FAVORITE_COMPONENTS_LIBRARY_ID } from "@/providers/ComponentLibraryProvider/libraries/migrateLegacyFavoriteFolder";
import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

import { withSuspenseWrapper } from "./SuspenseWrapper";

interface ComponentFavoriteToggleProps {
  component: ComponentReference;
  hideDelete?: boolean;
}

interface StateButtonProps {
  active?: boolean;
  isDanger?: boolean;
  onClick?: () => void;
}

const IconStateButton = ({
  active,
  isDanger = false,
  onClick,
  children,
}: PropsWithChildren<StateButtonProps>) => {
  const handleFavorite = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();

      onClick?.();
    },
    [onClick],
  );

  return (
    <Button
      onClick={handleFavorite}
      data-testid="favorite-star"
      className={cn(
        "w-fit h-fit p-1 hover:text-warning",
        active ? "text-warning" : "text-gray-500/50",
        {
          "hover:text-destructive": isDanger,
          "text-destructive": isDanger && active,
        },
      )}
      variant="ghost"
      size="icon"
    >
      {children}
    </Button>
  );
};

const FavoriteStarButton = ({ active, onClick }: StateButtonProps) => {
  return (
    <IconStateButton active={active} onClick={onClick}>
      <Star
        className="h-4 w-4"
        fill={active ? "oklch(79.5% 0.184 86.047)" : "none"}
      />
    </IconStateButton>
  );
};

const AddToLibraryButton = ({ active, onClick }: StateButtonProps) => {
  return (
    <IconStateButton active={active} onClick={onClick}>
      <PackagePlus className="h-4 w-4" />
    </IconStateButton>
  );
};

const DeleteFromLibraryButton = ({ active, onClick }: StateButtonProps) => {
  return (
    <IconStateButton active={active} onClick={onClick} isDanger>
      <Icon name="PackageX" />
    </IconStateButton>
  );
};

const ComponentFavoriteToggleSkeleton = () => {
  return <Spinner size={10} />;
};

/**
 * TODO: hide changes behind the beta flag
 */
export const ComponentFavoriteToggle = withSuspenseWrapper(
  ({ component, hideDelete = false }: ComponentFavoriteToggleProps) => {
    const {
      // this methods will be removed in the future, replaced by the new library
      addToComponentLibrary,
      removeFromComponentLibrary,
      checkIfUserComponent,
      checkLibraryContainsComponent,
      getComponentLibrary,
    } = useComponentLibrary();

    const [isOpen, setIsOpen] = useState(false);

    const favoriteLibrary = getComponentLibrary(FAVORITE_COMPONENTS_LIBRARY_ID);

    const { spec, url } = component;

    const { data: isFavorited, refetch: refetchFavorited } = useSuspenseQuery({
      queryKey: ["is-favorite-component", component.digest],
      queryFn: () => favoriteLibrary.hasComponent(component),
    });

    const isUserComponent = useMemo(
      () => checkIfUserComponent(component),
      [component, checkIfUserComponent],
    );

    const isInLibrary = useMemo(
      () => checkLibraryContainsComponent(component),
      [component, checkLibraryContainsComponent],
    );

    const displayName = useMemo(
      () => getComponentName({ spec, url }),
      [spec, url],
    );

    const onFavorite = useCallback(async () => {
      if (isFavorited) {
        await favoriteLibrary.removeComponent(component);
      } else {
        await favoriteLibrary.addComponent(component);
      }
      refetchFavorited();
    }, [isFavorited, refetchFavorited, favoriteLibrary, component]);

    // Delete User Components
    const handleDelete = useCallback(async () => {
      removeFromComponentLibrary(component);
    }, [removeFromComponentLibrary]);

    /* Confirmation Dialog handlers */
    const openConfirmationDialog = useCallback(() => {
      setIsOpen(true);
    }, []);

    const handleCancel = useCallback(() => {
      setIsOpen(false);
    }, []);

    const handleConfirm = useCallback(() => {
      setIsOpen(false);

      if (!isInLibrary) {
        addToComponentLibrary(component);
        return;
      }

      handleDelete();
    }, [component, isInLibrary, addToComponentLibrary, handleDelete]);

    const showDeleteButton = isInLibrary && isUserComponent && !hideDelete;

    return (
      <>
        {!isInLibrary && (
          <AddToLibraryButton onClick={openConfirmationDialog} />
        )}

        {isInLibrary && !isUserComponent && (
          <FavoriteStarButton active={isFavorited} onClick={onFavorite} />
        )}

        {showDeleteButton && (
          <DeleteFromLibraryButton onClick={openConfirmationDialog} />
        )}

        <ConfirmationDialog
          isOpen={isOpen}
          title={
            !isInLibrary
              ? "Add to Component Library?"
              : "Delete custom component?"
          }
          description={
            !isInLibrary
              ? `This will add "${displayName}" to your Component Library for use in your pipelines.`
              : `"${displayName}" is a custom user component. Unstarring it will remove it from your library. This action cannot be undone.`
          }
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </>
    );
  },
  ComponentFavoriteToggleSkeleton,
);
