import { bugsnagClient } from "./bugsnagClient";
import type { ErrorContext, ErrorMetadata } from "./types";

class ErrorReporter {
  private currentContext: ErrorContext = {};

  setUser(userId: string | undefined): void {
    this.currentContext.userId = userId;
  }

  setRequestId(requestId: string | undefined): void {
    this.currentContext.requestId = requestId;
  }

  setMetadata(metadata: ErrorMetadata): void {
    this.currentContext.metadata = {
      ...this.currentContext.metadata,
      ...metadata,
    };
  }

  clearMetadata(): void {
    this.currentContext.metadata = {};
  }

  async report(error: Error, additionalContext?: ErrorContext): Promise<void> {
    const context: ErrorContext = {
      ...this.currentContext,
      ...additionalContext,
      metadata: {
        ...this.currentContext.metadata,
        ...additionalContext?.metadata,
      },
    };

    await bugsnagClient.notify(error, context);
  }

  async startSession(): Promise<void> {
    await bugsnagClient.startSession(this.currentContext.userId);
  }

  cleanup(): void {
    bugsnagClient.cleanup();
  }

  isEnabled(): boolean {
    return bugsnagClient.isEnabled();
  }
}

export const errorReporter = new ErrorReporter();
