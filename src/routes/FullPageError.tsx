import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";

import { ErrorDisplay } from "@/components/shared/ErrorDisplay";

export default function FullPageError({ error }: ErrorComponentProps) {
  const router = useRouter();

  const handleGoHome = () => {
    router.navigate({ to: "/" });
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <ErrorDisplay
      error={error}
      onRefresh={handleRefresh}
      onGoHome={handleGoHome}
    />
  );
}
