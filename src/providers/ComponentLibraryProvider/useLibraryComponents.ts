import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import type { Library } from "./libraries/types";
import type { LibraryFilterRequest } from "./types";

const globalLibraryIdMap = new Map<Library, string>();

function libraryId(library: Library) {
  if (!globalLibraryIdMap.has(library)) {
    globalLibraryIdMap.set(library, crypto.randomUUID());
  }

  return globalLibraryIdMap.get(library)!;
}

export function useLibraryComponents(
  library: Library,
  filter?: LibraryFilterRequest,
) {
  const { data: folder, refetch } = useSuspenseQuery({
    queryKey: ["component-library", libraryId(library)],
    queryFn: () => library.getComponents(filter),
  });

  useEffect(() => {
    const handleChange = () => refetch();

    library.eventEmitter?.addEventListener("change", handleChange);
    return () => {
      library.eventEmitter?.removeEventListener("change", handleChange);
    };
  }, [library, refetch]);

  return folder;
}
