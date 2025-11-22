import { useSuspenseQuery } from "@tanstack/react-query";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { HOURS } from "@/components/shared/ComponentEditor/constants";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { isGitHubLibraryConfiguration } from "../types";
import { checkPATStatus } from "../utils/checkPATStatus";

export const TokenStatusButton = withSuspenseWrapper(
  ({
    library,
    onUpdateClick,
  }: {
    library: StoredLibrary;
    onUpdateClick: (library: StoredLibrary) => void;
  }) => {
    const { data: tokenStatus } = useSuspenseQuery({
      queryKey: ["github-token-status", library.id],
      queryFn: async () => {
        if (!isGitHubLibraryConfiguration(library.configuration)) {
          throw new Error("Invalid library configuration");
        }

        return checkPATStatus(
          library.configuration.repo_name,
          library.configuration.access_token,
        );
      },
      staleTime: 1 * HOURS,
    });
    return (
      <TooltipButton
        tooltip={`Token is ${tokenStatus ? "valid" : "invalid. Click to update."}`}
        variant="ghost"
        size="sm"
        disabled={tokenStatus}
        onClick={() => onUpdateClick(library)}
      >
        <Icon
          name={tokenStatus ? "Check" : "X"}
          className={cn(!tokenStatus && "text-red-500")}
        />
      </TooltipButton>
    );
  },
);
