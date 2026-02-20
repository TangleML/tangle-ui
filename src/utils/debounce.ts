interface DebouncedFunction<F extends (...args: Parameters<F>) => void> {
  (...args: Parameters<F>): void;
  cancel: () => void;
}

export const debounce = <F extends (...args: Parameters<F>) => void>(
  func: F,
  waitFor: number,
): DebouncedFunction<F> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };

  debounced.cancel = () => {
    clearTimeout(timeout);
    timeout = undefined;
  };

  return debounced;
};
