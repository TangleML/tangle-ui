/**
 * Sets the base URL for the application.
 * This is necessary for proper routing when the app is deployed to a subdirectory.
 */
export const setBaseUrl = () => {
  const base = document.createElement("base");
  base.setAttribute("href", import.meta.env.VITE_BASE_URL ?? "/");
  document.head.insertBefore(base, document.head.firstChild);
};
