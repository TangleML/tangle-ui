import { useSuspenseQuery } from "@tanstack/react-query";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { HOURS } from "@/components/shared/ComponentEditor/constants";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import {
  isGitHubLibraryConfiguration,
  isYamlLibraryConfiguration,
} from "../types";
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
        if (isGitHubLibraryConfiguration(library.configuration)) {
          return checkPATStatus(
            library.configuration.repo_name,
            library.configuration.access_token,
          );
        }

        if (isYamlLibraryConfiguration(library.configuration)) {
          // todo: check PAT status for YAML library
          return true;
        }

        throw new Error("Invalid library configuration");
      },
      staleTime: 1 * HOURS,
    });

    if (
      isYamlLibraryConfiguration(library.configuration) &&
      !library.configuration.access_token
    ) {
      return (
        <TooltipButton
          tooltip="No Personal Access Token provided"
          variant="ghost"
          size="sm"
          disabled
        >
          <Icon name="CircleSlash" />
        </TooltipButton>
      );
    }

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
  () => <Spinner />,
  ({ error }) => (
    <TooltipButton
      tooltip={`Error checking token status: ${error instanceof Error ? error.message : "Unknown error"}`}
      variant="ghost"
      size="sm"
      disabled
    >
      <Icon name="CircleAlert" />
    </TooltipButton>
  ),
);
