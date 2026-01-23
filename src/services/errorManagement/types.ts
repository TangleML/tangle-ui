export interface ErrorMetadata {
  [key: string]: unknown;
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  metadata?: ErrorMetadata;
}

export interface BugsnagEvent {
  apiKey: string;
  payloadVersion: string;
  notifier: {
    name: string;
  };
  events: Array<{
    exceptions: Array<{
      errorClass: string;
      message: string;
      stacktrace: Array<{
        file: string;
        lineNumber: number;
        columnNumber?: number;
        method: string;
        inProject?: boolean;
      }>;
    }>;
    severity: "error" | "warning" | "info";
    unhandled: boolean;
    device: {
      time: string;
      userAgent?: string;
    };
    user?: {
      id?: string;
    };
    metaData?: {
      custom?: ErrorMetadata;
      cgi_data?: {
        REQUEST_ID?: string;
      };
      extracted_values?: Record<string, string>;
    };
    request_id?: string;
    context_path?: string;
  }>;
}
