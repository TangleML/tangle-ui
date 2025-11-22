import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { checkPATStatus } from "../utils/checkPATStatus";
import { updateGitHubLibraryPAT } from "../utils/updateGitHubLibraryPAT";
import { validatePAT } from "../utils/validatePAT";
import { InputField } from "./InputField";

export const UpdateGitHubLibrary = ({
  library,
  onSuccess,
}: {
  onSuccess: () => void;
  library: StoredLibrary;
}) => {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const [state, setState] = useState<{
    value: string;
    hasErrors: boolean;
  }>({
    value: "",
    hasErrors: true,
  });

  const { mutate: updateGitHubLibrary, isPending } = useMutation({
    mutationFn: async (pat: string) => {
      const status = await checkPATStatus(
        library.configuration?.repo_name as string,
        pat,
      );

      if (!status) {
        throw new Error("Invalid Personal Access Token");
      }

      return await updateGitHubLibraryPAT(library, pat);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["github-token-status", library.id],
      });

      notify("GitHub library PAT updated successfully", "success");
      onSuccess?.();
    },
    onError: (error) => {
      notify(`Failed to update GitHub library PAT: ${error.message}`, "error");
    },
  });

  const handleSubmit = useCallback(async () => {
    if (state.hasErrors) {
      notify("Please fill in all fields", "error");
      return;
    }

    await updateGitHubLibrary(state.value);
  }, [updateGitHubLibrary, state]);

  return (
    <BlockStack gap="2">
      <InputField
        id="pat"
        label="Personal Access Token"
        placeholder="ghp_..."
        value=""
        validate={validatePAT}
        onChange={(value, error) => {
          setState((prev) => ({
            ...prev,
            value: value ?? "",
            hasErrors: !!error && error.length > 0,
          }));
        }}
      />

      <InlineStack gap="2" className="w-full" align="end">
        <Button
          type="button"
          disabled={state.hasErrors || isPending}
          onClick={handleSubmit}
        >
          Update PAT {isPending ? <Spinner /> : null}
        </Button>
      </InlineStack>
    </BlockStack>
  );
};
