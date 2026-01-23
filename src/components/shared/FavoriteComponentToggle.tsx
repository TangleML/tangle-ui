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
import { hydrateComponentReference } from "@/services/componentService";
import { type ComponentReference } from "@/utils/componentSpec";
import { MINUTES } from "@/utils/constants";
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

    const { getComponentLibrary } = useComponentLibrary();
    const favoriteComponentsLibrary = getComponentLibrary(
      "favorite_components",
    );
    const hydratedComponent = useGuaranteedHydrateComponentReference(component);

    const { data: isFavorited } = useSuspenseQuery({
      queryKey: favoriteComponentKey(hydratedComponent),
      queryFn: async () =>
        favoriteComponentsLibrary.hasComponent(hydratedComponent),
    });

    const { mutate: setFavorite } = useMutation({
      mutationFn: async () => {
        if (isFavorited) {
          await favoriteComponentsLibrary.removeComponent(hydratedComponent);
        } else {
          await favoriteComponentsLibrary.addComponent(hydratedComponent);
        }
      },
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

const useComponentFlags = (component: ComponentReference) => {
  const { getComponentLibrary } = useComponentLibrary();
  const componentLibrary = getComponentLibrary("standard_components");
  const userComponentsLibrary = getComponentLibrary("user_components");

  const { data } = useSuspenseQuery({
    queryKey: ["component", "flags", component.digest],
    queryFn: async () => {
      if (!componentLibrary)
        return { isInLibrary: false, isUserComponent: false };

      const isUserComponent =
        await userComponentsLibrary.hasComponent(component);

      return {
        isInLibrary: await componentLibrary.hasComponent(component),
        isUserComponent,
      };
    },
    staleTime: 10 * MINUTES,
  });

  return data;
};

const ComponentFavoriteToggleInternal = ({
  component,
  hideDelete = false,
}: ComponentFavoriteToggleProps) => {
  const { addToComponentLibrary, removeFromComponentLibrary } =
    useComponentLibrary();

  const [isOpen, setIsOpen] = useState(false);

  const { spec, url } = component;

  const { isInLibrary, isUserComponent } = useComponentFlags(component);

  const displayName = useMemo(
    () => getComponentName({ spec, url }),
    [spec, url],
  );

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

    if (!isUserComponent) {
      const hydratedComponent = await hydrateComponentReference(component);

      if (!hydratedComponent) {
        // todo: handle error
        console.error("Failed to hydrate component");
        return;
      }

      await addToComponentLibrary(hydratedComponent);
    } else {
      await removeFromComponentLibrary(component);
    }
  }, [
    component,
    isUserComponent,
    addToComponentLibrary,
    removeFromComponentLibrary,
  ]);

  const showDeleteButton = !isInLibrary && isUserComponent && !hideDelete;

  return (
    <>
      {!isInLibrary && !isUserComponent && (
        <AddToLibraryButton onClick={openConfirmationDialog} />
      )}

      {isInLibrary && <FavoriteToggleButton component={component} />}

      {showDeleteButton && (
        <DeleteFromLibraryButton onClick={openConfirmationDialog} />
      )}

      <ConfirmationDialog
        isOpen={isOpen}
        title={
          !isUserComponent
            ? "Add to Component Library?"
            : "Delete custom component?"
        }
        description={
          !isUserComponent
            ? `This will add "${displayName}" to your Component Library for use in your pipelines.`
            : `"${displayName}" is a custom user component. This will remove it from your library. This action cannot be undone.`
        }
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

export const ComponentFavoriteToggle = withSuspenseWrapper(
  ComponentFavoriteToggleInternal,
  () => <Spinner size={10} />,
  () => (
    <IconStateButton disabled>
      <Icon name="Star" />
    </IconStateButton>
  ),
);
