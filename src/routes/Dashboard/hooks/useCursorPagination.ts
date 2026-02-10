import { useState } from "react";

export function useCursorPagination() {
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [previousPageTokens, setPreviousPageTokens] = useState<string[]>([]);

  const handleNextPage = (nextPageToken: string | undefined) => {
    if (nextPageToken) {
      setPreviousPageTokens((prev) => [...prev, pageToken ?? ""]);
      setPageToken(nextPageToken);
    }
  };

  const handlePreviousPage = () => {
    const prev = previousPageTokens[previousPageTokens.length - 1];
    setPreviousPageTokens((tokens) => tokens.slice(0, -1));
    setPageToken(prev || undefined);
  };

  const handleFirstPage = () => {
    setPreviousPageTokens([]);
    setPageToken(undefined);
  };

  return {
    pageToken,
    previousPageTokens,
    handleNextPage,
    handlePreviousPage,
    handleFirstPage,
  };
}
