import { linkedRepositoryOf } from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";

export function repositoryLinkedMetadata(input: CreateResourceInput) {
  const linked = linkedRepositoryOf({
    metadata: input.metadata ?? null,
    payload: input.payload ?? null,
  });
  return {
    private: linked?.isPrivate ?? false,
    has_grant: linked?.grantId !== undefined,
  };
}
