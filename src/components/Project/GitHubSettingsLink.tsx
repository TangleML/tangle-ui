import { Link } from "@tanstack/react-router";

import { APP_ROUTES } from "@/routes/appRoutes";

export function GitHubSettingsLink() {
  return (
    <Link to={APP_ROUTES.SETTINGS_GITHUB} target="_blank" className="underline">
      Settings → GitHub
    </Link>
  );
}
