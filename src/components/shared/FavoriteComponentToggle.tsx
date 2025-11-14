import { PackagePlus, Star } from "lucide-react";
import type { MouseEvent, PropsWithChildren } from "react";
import { useCallback, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

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

export const ComponentFavoriteToggle = ({
  component,
  hideDelete = false,
}: ComponentFavoriteToggleProps) => {
  const {
    addToComponentLibrary,
    removeFromComponentLibrary,
    checkIfFavorited,
    checkIfUserComponent,
    checkLibraryContainsComponent,
    setComponentFavorite,
  } = useComponentLibrary();

  const [isOpen, setIsOpen] = useState(false);

  const { spec, url } = component;

  const isFavorited = useMemo(
    () => checkIfFavorited(component),
    [component, checkIfFavorited],
  );

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

  const onFavorite = useCallback(() => {
    setComponentFavorite(component, !isFavorited);
  }, [component, isFavorited, setComponentFavorite]);

  // Delete User Components
  const handleDelete = useCallback(async () => {
    removeFromComponentLibrary(component);
  }, [component, removeFromComponentLibrary]);

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
      {!isInLibrary && <AddToLibraryButton onClick={openConfirmationDialog} />}

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
};
