import { QueryErrorResetBoundary } from "@tanstack/react-query";
import {
  type ComponentProps,
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
  Suspense,
} from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";

import TooltipButton from "./Buttons/TooltipButton";

type ErrorFallbackProps<T extends ComponentType<any>> = FallbackProps & {
  originalProps?: Partial<ComponentProps<T>>;
};

interface SuspenseWrapperProps {
  fallback?: ReactNode;
  errorFallback?: (props: FallbackProps) => ReactNode;
}

const ErrorFallback = <T extends ComponentType<any>>({
  resetErrorBoundary,
}: ErrorFallbackProps<T>) => {
  const tooltipText = "A UI element failed to render. Click to retry.";

  return (
    <TooltipButton
      tooltip={tooltipText}
      aria-label={tooltipText}
      onClick={() => resetErrorBoundary()}
      variant="ghost"
      size="min"
    >
      <Icon name="MonitorX" className="text-destructive" />
    </TooltipButton>
  );
};

export const SuspenseWrapper = ({
  children,
  fallback,
  errorFallback = ErrorFallback,
}: PropsWithChildren<SuspenseWrapperProps>) => {
  const fallbackMarkup = fallback ?? <Spinner />;

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset} fallbackRender={errorFallback}>
          <Suspense fallback={fallbackMarkup}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};
SuspenseWrapper.displayName = "SuspenseWrapper";

/**
 * Wraps a component in a SuspenseWrapper.
 *
 * @param Component - The component to wrap.
 * @param Skeleton - The skeleton to show while the component is loading. Must be a component with no required props.
 * @returns The wrapped component.
 */
export function withSuspenseWrapper<T extends ComponentType<any>>(
  Component: T,
  Skeleton?: ComponentType<Partial<ComponentProps<T>>>,
  errorFallback?: (props: ErrorFallbackProps<T>) => ReactNode,
) {
  const ErrorFallbackComponent = errorFallback ?? ErrorFallback<T>;
  const ComponentWithSuspense = (props: ComponentProps<T>) => (
    <SuspenseWrapper
      fallback={Skeleton ? <Skeleton {...props} /> : undefined}
      errorFallback={(errorProps) => (
        <ErrorFallbackComponent {...errorProps} originalProps={props} />
      )}
    >
      <Component {...props} />
    </SuspenseWrapper>
  );
  ComponentWithSuspense.displayName = `SuspenseWrapper(${Component.displayName ?? Component.name ?? "Component"})`;
  return ComponentWithSuspense;
}
