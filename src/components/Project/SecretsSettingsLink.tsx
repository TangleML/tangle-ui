import { Link } from "@tanstack/react-router";

import { APP_ROUTES } from "@/routes/appRoutes";

export function SecretsSettingsLink() {
  return (
    <Link to={APP_ROUTES.SETTINGS_SECRETS} className="underline">
      Settings → Secrets
    </Link>
  );
}
