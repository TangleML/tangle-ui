import { getBugsnagConfig } from "./config";
import type { BugsnagEvent, ErrorContext } from "./types";

class BugsnagClient {
  private config = getBugsnagConfig();

  // Rate limiting state
  private errorTimestamps: number[] = [];
  private isSpamMode = false;
  private errorQueue: Array<{ error: Error; context?: ErrorContext }> = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private spamModeStartTime: number | null = null;

  // Rate limiting constants
  private readonly SPAM_THRESHOLD = 5; // errors
  private readonly SPAM_WINDOW = 10000; // 10 seconds
  private readonly BATCH_SEND_INTERVAL = 15000; // 15 seconds
  private readonly SPAM_MODE_RESET = 60000; // 60 seconds

  /**
   * Check if we're in spam mode and should batch errors.
   * Spam mode is triggered when >5 errors occur within 10 seconds.
   */
  private checkSpamMode(): void {
    const now = Date.now();

    // Remove timestamps older than the spam window
    this.errorTimestamps = this.errorTimestamps.filter(
      (timestamp) => now - timestamp < this.SPAM_WINDOW,
    );

    // Add current timestamp
    this.errorTimestamps.push(now);

    // Check if we've exceeded the threshold
    if (!this.isSpamMode && this.errorTimestamps.length > this.SPAM_THRESHOLD) {
      this.enterSpamMode();
    }

    // Check if we should exit spam mode (after 60 seconds)
    if (this.isSpamMode && this.spamModeStartTime) {
      if (now - this.spamModeStartTime > this.SPAM_MODE_RESET) {
        this.exitSpamMode();
      }
    }
  }

  /**
   * Enter spam mode: start batching errors and sending every 15 seconds.
   */
  private enterSpamMode(): void {
    console.warn(
      `[Tangle Error Reporter] Spam threshold exceeded (${this.SPAM_THRESHOLD} errors in ${this.SPAM_WINDOW / 1000}s). ` +
        `Switching to batch mode. Errors will be sent every ${this.BATCH_SEND_INTERVAL / 1000}s.`,
    );

    this.isSpamMode = true;
    this.spamModeStartTime = Date.now();

    // Start batch interval
    this.batchInterval = setInterval(() => {
      this.sendBatch();
    }, this.BATCH_SEND_INTERVAL);
  }

  /**
   * Exit spam mode: return to instant error reporting.
   */
  private exitSpamMode(): void {
    console.log(
      `[Tangle Error Reporter] Spam mode reset after ${this.SPAM_MODE_RESET / 1000}s. ` +
        `Returning to instant error reporting.`,
    );

    this.isSpamMode = false;
    this.spamModeStartTime = null;
    this.errorTimestamps = [];

    // Clear batch interval
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    // Send any remaining queued errors
    if (this.errorQueue.length > 0) {
      this.sendBatch();
    }
  }

  /**
   * Send all queued errors as a batch.
   */
  private async sendBatch(): Promise<void> {
    if (this.errorQueue.length === 0) {
      return;
    }

    console.log(
      `[Tangle Error Reporter] Sending batch of ${this.errorQueue.length} errors`,
    );

    const batch = [...this.errorQueue];
    this.errorQueue = [];

    // Send each error (Bugsnag doesn't support batching in one request)
    for (const { error, context } of batch) {
      await this.sendError(error, context);
    }
  }

  /**
   * Extract dynamic values from error message and replace with numbered placeholders.
   * Returns both the normalized message and a metadata object with extracted values.
   */
  private extractAndNormalizeErrorClass(message: string): {
    normalizedMessage: string;
    extractedValues: Record<string, string>;
  } {
    const extractedValues: Record<string, string> = {};
    let counter = 1;

    let normalized = message;

    // Special handling for React Query errors - preserve query key names
    normalized = normalized.replace(
      /React Query Error \[\[("([^"]+)"),([^\]]+)\]\]/g,
      (_match, quotedKey, _keyName, rest) => {
        // Preserve the query key name, but normalize the rest
        const normalizedRest = rest.replace(
          /"([^"]+)"/g,
          (innerMatch: string, value: string) => {
            // Check if it looks like an ID (has numbers or is a long hex string)
            if (/\d/.test(value) || /^[a-f0-9]{8,}$/i.test(value)) {
              const placeholder = `{var${counter}}`;
              extractedValues[placeholder] = value;
              counter++;
              return placeholder;
            }
            return innerMatch;
          },
        );
        return `React Query Error [[${quotedKey},${normalizedRest}]]`;
      },
    );

    // Extract UUIDs
    normalized = normalized.replace(
      /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$|\)|\s)/gi,
      (_match, uuid, after) => {
        const placeholder = `{var${counter}}`;
        extractedValues[placeholder] = uuid;
        counter++;
        return `/${placeholder}${after}`;
      },
    );

    // Extract pure numeric IDs in paths
    normalized = normalized.replace(
      /\/(\d+)(\/|$|\)|\s)/g,
      (_match, num, after) => {
        const placeholder = `{var${counter}}`;
        extractedValues[placeholder] = num;
        counter++;
        return `/${placeholder}${after}`;
      },
    );

    // Extract alphanumeric IDs (long ones that have both letters and numbers)
    normalized = normalized.replace(
      /\/([a-zA-Z0-9]*\d[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{6,}|[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]*\d[a-zA-Z0-9]{6,})(\/|$|\)|\s)/g,
      (_match, id, after) => {
        const placeholder = `{var${counter}}`;
        extractedValues[placeholder] = id;
        counter++;
        return `/${placeholder}${after}`;
      },
    );

    // Extract query param IDs
    normalized = normalized.replace(
      /([?&][a-zA-Z_]+)=([0-9a-zA-Z-]{6,})/g,
      (_match, key, value) => {
        if (/\d/.test(value) || /^[a-f0-9]+$/i.test(value)) {
          const placeholder = `{var${counter}}`;
          extractedValues[placeholder] = value;
          counter++;
          return `${key}=${placeholder}`;
        }
        return _match;
      },
    );

    // Extract hash/digest values
    normalized = normalized.replace(/\b([a-f0-9]{16,})\b/gi, (_match, hash) => {
      const placeholder = `{var${counter}}`;
      extractedValues[placeholder] = hash;
      counter++;
      return placeholder;
    });

    // Extract quoted strings (but skip if already handled by React Query)
    normalized = normalized.replace(/"([^"]+)"/g, (_match, content) => {
      // Don't replace if this is part of a React Query Error that we already handled
      if (
        normalized.includes(`React Query Error`) &&
        _match.includes(content)
      ) {
        return _match;
      }
      const placeholder = `{var${counter}}`;
      extractedValues[placeholder] = content;
      counter++;
      return placeholder;
    });

    normalized = normalized.replace(/'([^']+)'/g, (_match, content) => {
      const placeholder = `{var${counter}}`;
      extractedValues[placeholder] = content;
      counter++;
      return placeholder;
    });

    // Extract standalone large numbers, but preserve HTTP status codes
    normalized = normalized.replace(
      /\b\d{3,}\b/g,
      (_match, offset, fullString) => {
        const beforeMatch = fullString.substring(
          Math.max(0, offset - 5),
          offset,
        );
        if (beforeMatch.endsWith("HTTP ")) {
          return _match; // Keep HTTP status codes
        }
        const placeholder = `{var${counter}}`;
        extractedValues[placeholder] = _match;
        counter++;
        return placeholder;
      },
    );

    // Clean up multiple spaces and empty parentheses
    normalized = normalized
      .replace(/\s+/g, " ")
      .replace(/\(\s*\)/g, "")
      .trim();

    // Limit length
    if (normalized.length > 200) {
      normalized = normalized.substring(0, 197) + "...";
    }

    return { normalizedMessage: normalized, extractedValues };
  }

  private parseStackTrace(error: Error) {
    const stack = error.stack || "";
    const lines = stack.split("\n").slice(1);

    return lines
      .map((line) => {
        // Standard format: "at functionName (file:line:col)"
        const match = line.match(/at (.+?) \((.+?):(\d+):(\d+)\)/);
        if (match) {
          return {
            method: match[1],
            file: match[2],
            lineNumber: parseInt(match[3], 10),
            columnNumber: parseInt(match[4], 10),
          };
        }

        // Simple format: "at file:line:col"
        const simpleMatch = line.match(/at (.+?):(\d+):(\d+)/);
        if (simpleMatch) {
          return {
            method: "(anonymous)",
            file: simpleMatch[1],
            lineNumber: parseInt(simpleMatch[2], 10),
            columnNumber: parseInt(simpleMatch[3], 10),
          };
        }

        return null;
      })
      .filter((frame): frame is NonNullable<typeof frame> => frame !== null);
  }

  /**
   * Public API: Report an error to Bugsnag.
   * Handles rate limiting and batching automatically.
   */
  async notify(error: Error, context?: ErrorContext): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Check spam mode
    this.checkSpamMode();

    if (this.isSpamMode) {
      // Queue error for batch sending
      this.errorQueue.push({ error, context });
    } else {
      // Send immediately
      await this.sendError(error, context);
    }
  }

  /**
   * Internal method to actually send an error to the error reporting service.
   */
  private async sendError(error: Error, context?: ErrorContext): Promise<void> {
    // Extract and normalize error message
    const { normalizedMessage, extractedValues } =
      this.extractAndNormalizeErrorClass(error.message || "Unknown error");

    const event: BugsnagEvent = {
      apiKey: this.config.apiKey,
      payloadVersion: "5",
      notifier: {
        name: "Tangle UI",
      },
      events: [
        {
          exceptions: [
            {
              errorClass: normalizedMessage,
              message: error.message || "Unknown error",
              stacktrace: this.parseStackTrace(error),
            },
          ],
          severity: "error",
          unhandled: false,
          device: {
            time: new Date().toISOString(),
            userAgent: navigator.userAgent,
          },
          ...(context?.userId && { user: { id: context.userId } }),
          ...(context?.requestId && { request_id: context.requestId }),
          metaData: {
            custom: {
              ...context?.metadata,
              ...(this.config.customGroupingKey && {
                [this.config.customGroupingKey]: normalizedMessage,
              }),
            },
            ...(context?.requestId && {
              cgi_data: { REQUEST_ID: context.requestId },
            }),
            ...(Object.keys(extractedValues).length > 0 && {
              extracted_values: extractedValues,
            }),
          },
          context_path: window.location.pathname,
        },
      ],
    };

    try {
      const response = await fetch(this.config.notifyEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error(
          `Error reporting notify failed: ${response.status} ${response.statusText}`,
          responseText,
        );
      }
    } catch (notifyError) {
      console.error("Failed to send error to Bugsnag:", notifyError);
    }
  }

  async startSession(userId?: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const session = {
      notifier: {
        name: "Tangle UI",
      },
      device: {
        time: new Date().toISOString(),
      },
      sessions: [
        {
          id: crypto.randomUUID(),
          startedAt: new Date().toISOString(),
          user: userId ? { id: userId } : undefined,
        },
      ],
    };

    try {
      await fetch(this.config.sessionsEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(session),
      });
    } catch (sessionError) {
      console.error("Failed to start error reporting session:", sessionError);
    }
  }

  /**
   * Clean up intervals and send any remaining queued errors.
   * Call this when shutting down Bugsnag reporting.
   */
  cleanup(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    // Send any remaining errors
    if (this.errorQueue.length > 0) {
      this.sendBatch();
    }

    this.errorTimestamps = [];
    this.errorQueue = [];
    this.isSpamMode = false;
    this.spamModeStartTime = null;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Export both the class (for testing) and the singleton instance
export { BugsnagClient };
export const bugsnagClient = new BugsnagClient();
