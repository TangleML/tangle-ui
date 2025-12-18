import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { PackagePlus, Star } from "lucide-react";
import type { ComponentProps, MouseEvent, PropsWithChildren } from "react";
import { useCallback, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { useGuaranteedHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import { cn } from "@/lib/utils";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { isFavoriteComponent } from "@/providers/ComponentLibraryProvider/componentLibrary";
import { hydrateComponentReference } from "@/services/componentService";
import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

import { withSuspenseWrapper } from "./SuspenseWrapper";

interface ComponentFavoriteToggleProps {
  component: ComponentReference;
  hideDelete?: boolean;
}

interface StateButtonProps extends ComponentProps<typeof Button> {
  active?: boolean;
  isDanger?: boolean;
  onClick?: () => void;
}

const IconStateButton = ({
  active,
  isDanger = false,
  onClick,
  children,
  ...props
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
      {...props}
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

const favoriteComponentKey = (component: ComponentReference) => {
  return ["component", "is-favorite", component.digest];
};

const FavoriteToggleButton = withSuspenseWrapper(
  ({ component }: { component: ComponentReference }) => {
    const queryClient = useQueryClient();

    const { setComponentFavorite } = useComponentLibrary();
    const hydratedComponent = useGuaranteedHydrateComponentReference(component);

    const { data: isFavorited } = useSuspenseQuery({
      queryKey: favoriteComponentKey(hydratedComponent),
      queryFn: async () => isFavoriteComponent(hydratedComponent),
    });

    const { mutate: setFavorite } = useMutation({
      mutationFn: async () =>
        setComponentFavorite(hydratedComponent, !isFavorited),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: favoriteComponentKey(hydratedComponent),
        });
      },
    });

    return <FavoriteStarButton active={isFavorited} onClick={setFavorite} />;
  },
  () => <Spinner size={10} />,
  () => (
    <IconStateButton disabled>
      <Icon name="Star" />
    </IconStateButton>
  ),
);

export const ComponentFavoriteToggle = ({
  component,
  hideDelete = false,
}: ComponentFavoriteToggleProps) => {
  const {
    addToComponentLibrary,
    removeFromComponentLibrary,
    checkIfUserComponent,
    checkLibraryContainsComponent,
  } = useComponentLibrary();

  const [isOpen, setIsOpen] = useState(false);

  const { spec, url } = component;

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

  // todo: rewrite with useMutation
  const handleConfirm = useCallback(async () => {
    setIsOpen(false);

    if (!isInLibrary) {
      const hydratedComponent = await hydrateComponentReference(component);

      if (!hydratedComponent) {
        // todo: handle error
        console.error("Failed to hydrate component");
        return;
      }

      addToComponentLibrary(hydratedComponent);
      return;
    }

    handleDelete();
  }, [component, isInLibrary, addToComponentLibrary, handleDelete]);

  const showDeleteButton = isInLibrary && isUserComponent && !hideDelete;

  return (
    <>
      {!isInLibrary && <AddToLibraryButton onClick={openConfirmationDialog} />}

      {isInLibrary && !isUserComponent && (
        <FavoriteToggleButton component={component} />
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
