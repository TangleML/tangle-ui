import { useEffect, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

export function usePagination<T>(
  items: T[],
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey = "",
) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  const totalPages = Math.ceil(items.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginatedItems = items.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return {
    paginatedItems,
    currentPage: safePage,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
    goToNextPage: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
    goToPreviousPage: () => setCurrentPage((p) => Math.max(1, p - 1)),
    resetPage: () => setCurrentPage(1),
  };
}
