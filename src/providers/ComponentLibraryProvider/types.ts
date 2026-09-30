export interface LibraryFilterRequest {
  searchTerm?: string;
  filters?: string[];
}

type ContentfulFilterRequest = Required<LibraryFilterRequest>;

function isContentfulFilterRequest(
  filter?: LibraryFilterRequest,
): filter is ContentfulFilterRequest {
  return Boolean(
    filter?.searchTerm && filter.searchTerm.length > 0 && filter.filters,
  );
}

export function isValidFilterRequest(
  filter?: LibraryFilterRequest,
  options: {
    minLength?: number;
    includesFilter?: string;
  } = {},
): filter is ContentfulFilterRequest {
  return Boolean(
    isContentfulFilterRequest(filter) &&
      filter.searchTerm.trim().length >= (options?.minLength ?? 1) &&
      (!options.includesFilter ||
        filter.filters.includes(options.includesFilter)),
  );
}
