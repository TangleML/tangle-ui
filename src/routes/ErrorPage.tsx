import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";

import { ErrorHandler } from "@/components/shared/ErrorHandler";

export default function ErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter();

  const handleGoHome = () => {
    router.navigate({ to: "/" });
  };

  return (
    <ErrorHandler
      error={error}
      errorType="router_error"
      onGoHome={handleGoHome}
    />
  );
}
