import { useThemeOptional } from "@/providers/ThemeProvider";

/**
 * Maps the app's resolved theme to a Monaco editor theme id so embedded
 * editors follow light/dark mode instead of being pinned to one theme.
 *
 * Reads the theme optionally so editors mounted outside a ThemeProvider
 * (e.g. isolated unit tests) fall back to light instead of throwing.
 */
export const useMonacoTheme = () => {
  const theme = useThemeOptional();
  return theme?.resolvedTheme === "dark" ? "vs-dark" : "light";
};
