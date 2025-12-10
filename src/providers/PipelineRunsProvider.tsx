import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { GitHubAuthFlowBackdrop } from "@/components/shared/GitHubAuth/GitHubAuthFlowBackdrop";
import type { PipelineRun } from "@/types/pipelineRun";
import { type ComponentSpec } from "@/utils/componentSpec";
import { submitPipelineRun } from "@/utils/submitPipeline";

import {
  createRequiredContext,
  useRequiredContext,
} from "../hooks/useRequiredContext";
import { useBackend } from "./BackendProvider";

type PipelineRunsContextType = {
  isSubmitting: boolean;
  error: string | null;
  submit: (
    componentSpec: ComponentSpec,
    options: {
      onSuccess: (data: PipelineRun) => void;
      onError: (error: Error | string) => void;
    },
  ) => Promise<void>;
};

const PipelineRunsContext = createRequiredContext<PipelineRunsContextType>(
  "PipelineRunsProvider",
);

/**
 * @deprecated  Submit should be moved as "useMutation". Github backdrop may be removed until we support Github Auth.
 */
export const PipelineRunsProvider = ({ children }: { children: ReactNode }) => {
  const {
    awaitAuthorization,
    isAuthorized,
    isPopupOpen,
    closePopup,
    bringPopupToFront,
  } = useAwaitAuthorization();
  const queryClient = useQueryClient();
  const { getToken } = useAuthLocalStorage();

  const { backendUrl } = useBackend();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorizationToken = useRef<string | undefined>(getToken());

  const submit = useCallback(
    async (
      componentSpec: ComponentSpec,
      options?: {
        onSuccess?: (data: PipelineRun) => void;
        onError?: (error: Error | string) => void;
      },
    ) => {
      setIsSubmitting(true);
      setError(null);

      const authorizationRequired = isAuthorizationRequired();
      if (authorizationRequired && !isAuthorized) {
        const token = await awaitAuthorization();
        if (token) {
          authorizationToken.current = token;
        }
      }

      await submitPipelineRun(componentSpec, backendUrl, {
        authorizationToken: authorizationToken.current,
        onSuccess: async (data) => {
          await queryClient.invalidateQueries({
            queryKey: ["pipelineRuns"],
          });
          setIsSubmitting(false);
          options?.onSuccess?.(data);
        },
        onError: (error) => {
          setIsSubmitting(false);
          options?.onError?.(error);
          setError(error.message);
        },
      });
    },
    [backendUrl, isAuthorized, awaitAuthorization, isAuthorizationRequired],
  );

  const value = useMemo(
    () => ({
      isSubmitting,
      error,

      submit,
    }),
    [error, isSubmitting, submit],
  );

  return (
    <PipelineRunsContext.Provider value={value}>
      {children}
      <GitHubAuthFlowBackdrop
        isOpen={isPopupOpen}
        onClose={closePopup}
        onClick={bringPopupToFront}
      />
    </PipelineRunsContext.Provider>
  );
};

export const usePipelineRuns = () => {
  return useRequiredContext(PipelineRunsContext);
};
