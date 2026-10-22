export const normalizeForSearch = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/^["]|["]$/g, "");
};

export const containsSearchTerm = (
  text: string | undefined,
  searchTerm: string,
  exactMatch: boolean = false,
): boolean => {
  if (!text) return false;

  const normalizedText = normalizeForSearch(text);
  const normalizedSearchTerm = normalizeForSearch(searchTerm);

  if (exactMatch) {
    return normalizedText === normalizedSearchTerm;
  }

  return normalizedText.includes(normalizedSearchTerm);
};
