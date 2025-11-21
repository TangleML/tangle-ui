import { useMutation } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";

import { isHuggingFaceAuthEnabled } from "../HuggingFaceAuth/constants";

export function useLogout({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const { backendUrl } = useBackend();
  return useMutation({
    mutationFn: async () => {
      if (isHuggingFaceAuthEnabled()) {
        await fetch(`${backendUrl}/api/oauth/huggingface/logout`, {
          method: "GET",
        });
      }
    },
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}
