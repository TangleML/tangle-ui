import { Outlet } from "@tanstack/react-router";
import { Suspense } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";

function SecretsSettingsSkeleton() {
  return (
    <BlockStack align="center" className="py-8">
      <Spinner size={10} />
    </BlockStack>
  );
}

export function SecretsSettings() {
  return (
    <Suspense fallback={<SecretsSettingsSkeleton />}>
      <Outlet />
    </Suspense>
  );
}
